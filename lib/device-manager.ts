import { IUnitOfWork } from "../db/interfaces/unit-of-work";

import {
    AndroidController,
    IOSController,
    DeviceController,
    IDevice,
    Device,
    Platform,
    DeviceType,
    Status
} from "mobile-devices-controller";
import { log, resolve, getAllFileNames } from "./utils";
import { Stats, rmdirSync } from "fs";
import { join } from "path";

export class DeviceManager {

    private readonly maxDeviceUsage;
    private readonly maxDeviceRebootCycles;
    private _usedDevices: Map<string, number>;

    constructor(private _unitOfWork: IUnitOfWork, private _useLocalRepository = true) {
        this._usedDevices = new Map<string, number>();
        this.maxDeviceUsage = 10;
        this.maxDeviceRebootCycles = 5;
    }

    public async boot(query, count, shouldUpdate = true) {
        if (!query.platform && query.type) {
            query.platform = query.platform ? query.platform : (query.type === DeviceType.EMULATOR ? Platform.ANDROID : Platform.IOS);
        }

        const simulators = await this._unitOfWork.devices.find(query);
        const maxDevicesToBoot = Math.min(simulators.length, parseInt(count || 1));
        const bootedDevices = new Array<IDevice>();

        for (var index = 0; index < maxDevicesToBoot; index++) {
            const device = await DeviceController.startDevice(simulators[index]);
            if (shouldUpdate) {
                const result = await this._unitOfWork.devices.update(device.token, device);
            }
            bootedDevices.push(device);
        }

        return bootedDevices;
    }

    public async subscribeForDevice(query): Promise<IDevice> {
        const maxDeviceRebootCycles = query["maxDeviceRebootCycles"] > 0 ? query["maxDeviceRebootCycles"] : this.maxDeviceRebootCycles;
        delete query["maxDeviceRebootCycles"];
        const searchQuery: IDevice = DeviceManager.convertIDeviceToQuery(query);
        delete searchQuery.info;
        searchQuery.status = Status.BOOTED;

        let bootedDevicesByQuery = await this._unitOfWork.devices.find(searchQuery);

        let device: any = bootedDevicesByQuery.length > 0 ? bootedDevicesByQuery[0] : undefined;
        if (device && this.isAndroid(device)
            && (this.checkDeviceUsageHasReachedLimit(maxDeviceRebootCycles, device)
                || AndroidController.checkApplicationNotRespondingDialogIsDisplayed(device))) {
            AndroidController.reboot(device);
            log(`Device: ${device.name}/ ${device.token} is rebooted!`);
            this.resetUsage(device);
        }

        if (!device) {
            searchQuery.status = Status.SHUTDOWN;
            device = await this._unitOfWork.devices.findSingle(searchQuery);

            if (device) {
                let bootedDevice = (await this.boot({ token: device.token }, 1, false))[0];
                if (!bootedDevice || !bootedDevice.token) {
                    this.killDevice(bootedDevice);
                    log(`Failed to boot device! Result: `, bootedDevice);
                    bootedDevice = (await this.boot({ token: device.token }, 1, false))[0];
                    if (!bootedDevice) {
                        throw Error("Failed to boot device!!!");
                    }
                }

                device.startedAt = bootedDevice.startedAt;
                device.status = bootedDevice.status;

                device.pid = bootedDevice.pid;
                this.resetUsage(device);
            }
        }

        if (device) {
            device.info = query.info;
            const markedDevice = await this.mark(device);
            device.busySince = markedDevice.busySince;
            device.status = <Status>markedDevice.status;

            const updateResult = await this._unitOfWork.devices.update(device.token, <IDevice>device);
            device = await this._unitOfWork.devices.findByToken(device.token);
            this.increaseDevicesUsage(device);
        } else {
            log(`Could find device ${query}`);
            device = await this.unmark(device);
        }

        return <IDevice>device;
    }

    public async unsubscribeFromDevice(query, maxDeviceUsage): Promise<IDevice> {
        const device = await this._unitOfWork.devices.findByToken(query.token);
        if (device) {
            device.busySince = -1;
            device.info = undefined;
            device.status = device.status !== Status.SHUTDOWN ? Status.BOOTED : Status.SHUTDOWN;
            return await this.unmark(device);
        }
        maxDeviceUsage = maxDeviceUsage > 0 ? maxDeviceUsage : this.maxDeviceUsage;
        if (device && this.checkDeviceUsageHasReachedLimit(maxDeviceUsage, device)) {
            await this.killDevice(device);
        }

        await this.killDevicesOverLimit({ type: device.type });
    }

    private async unmark(query) {
        if (!query || !query['token']) {
            return;
        }
        const updateQuery: any = {};

        updateQuery.token = query['token'];
        updateQuery.busySince = -1;
        updateQuery.info = undefined;
        updateQuery.status = query.status || Status.BOOTED;

        const result = await this._unitOfWork.devices.update(query['token'], <IDevice>updateQuery);
        const device = await this._unitOfWork.devices.findByToken(query['token']);
        log(`Unmark result for device: ${device.name}:`, result);
        return device;
    }

    private async killDevicesOverLimit(query) {
        const maxDevicesCount = (query.type === DeviceType.EMULATOR ? process.env['MAX_EMU_COUNT'] : process.env['MAX_SIM_COUNT']) || 1;
        const bootedDevices = await this._unitOfWork.devices.find(<IDevice>{ type: query.type, status: Status.BOOTED });
        const busyDevices = await this._unitOfWork.devices.find(<IDevice>{ type: query.type, status: Status.BUSY });

        const bootedDevicesLength = bootedDevices.length;
        if (maxDevicesCount < bootedDevicesLength + busyDevices.length) {
            for (let index = 0; index < bootedDevicesLength; index++) {
                const device = bootedDevices[index];
                log(`Killing booted device ${device.name}, since the limit for max devices count: ${maxDevicesCount} is reached!`);
                await this.killDevice(device);
            }
        }
    }

    public async killDevices(query?) {
        const updateQuery = DeviceManager.convertIDeviceToQuery(query || {});
        updateQuery.status = Status.SHUTDOWN;
        updateQuery.startedAt = -1;
        updateQuery.busySince = -1;

        if (this._useLocalRepository) {
            IOSController.killAll();
            AndroidController.killAll();
            return this.refreshData(query, updateQuery);
        }

        if (!query) {
            await this._unitOfWork.devices.dropDb();
            IOSController.killAll();
            await this.refreshData({ platform: Platform.IOS }, updateQuery);
            AndroidController.killAll();
            await this.refreshData({ platform: Platform.ANDROID }, updateQuery);
            return this._unitOfWork.devices.find(updateQuery);
        } else {
            const devices = await this._unitOfWork.devices.find(<IDevice>query);
            devices.forEach(async (device) => {
                await DeviceController.kill(device);
                const log = await this._unitOfWork.devices.update(device.token, <IDevice>updateQuery);
            });
        }

        await this.refreshData(query, updateQuery);
    }

    public async refreshData(query, updateQuery) {
        return new Promise(async (resolve, reject) => {
            if (this._useLocalRepository) {
                this._unitOfWork.devices.dropDb();
                resolve();
            } else {
                const parsedDevices = await DeviceController.getDevices(<IDevice>query);

                const devices = new Array();
                parsedDevices.forEach(device => {
                    devices.push(DeviceManager.deviceToJSON(device));
                });

                await this._unitOfWork.devices.deleteMany(query);
                await this._unitOfWork.devices.addMany(devices);
                const result = await this._unitOfWork.devices.find(<Device>updateQuery);

                resolve(result);
            };
        });
    }

    public async dropdb() {
        await this._unitOfWork.devices.dropDb();
        return await this.refreshData({}, {});
    }

    public async update(token, udpateQuery) {
        return await this._unitOfWork.devices.update(token, <Device>udpateQuery)
    }

    public checkDeviceStatus(maxUsageTime) {
        setInterval(async () => {
            const devices = await this._unitOfWork.devices.find(<IDevice>{ status: Status.BUSY });
            devices.forEach(async (device) => {
                const now = Date.now();
                if (now - device.startedAt > maxUsageTime) {
                    await this.killDevices(device);
                    await this.boot({ "name": device.name }, 1);
                }
            });
        }, 300000);
    }

    private async killDevice(device) {
        log(`Kill device: ${device}`);
        this.resetUsage(device);
        await DeviceController.kill(device);
        if (this.isAndroid(device)) {
            const avdsDirectory = process.env["AVDS_STORAGE"] || join(process.env["HOME"], "/.android/avd");
            const avd = resolve(avdsDirectory, `${device.name}.avd`);
            getAllFileNames(avd).filter(f => f.endsWith(".lock")).forEach(f => {
                rmdirSync(f);
            });
        }
        const updateQuery: any = {};
        updateQuery['status'] = Status.SHUTDOWN;
        updateQuery['startedAt'] = -1;
        updateQuery['busySince'] = -1;
        updateQuery['pid'] = 0;
        updateQuery['info'] = "";

        const updateResult = await this._unitOfWork.devices.update(device.token, <Device>updateQuery);
        const killedDevice = await this._unitOfWork.devices.findSingle(<Device>{ "token": device.token });
        if (killedDevice.status !== Status.SHUTDOWN) {
            log(`Device status not updated after! Result`, updateResult);
            await this._unitOfWork.devices.update(killedDevice.token, <Device>{ status: Status.SHUTDOWN });
        }

        log('Result for updated killed device: ', killedDevice);
    }

    private async mark(query): Promise<{ status: Status, busySince: number }> {
        const updateQuery: any = {};
        updateQuery['status'] = Status.BUSY;
        updateQuery['busySince'] = Date.now();
        const result = await this._unitOfWork.devices.update(query.token, <Device>updateQuery);
        return updateQuery;
    }

    private async createModel(device: IDevice) {
        return await this._unitOfWork.devices.add(DeviceManager.deviceToJSON(device));
    }

    private static deviceToJSON(device: IDevice) {
        return {
            name: device.name,
            token: device.token,
            status: device.status,
            startedAt: device.startedAt,
            busySince: device.busySince,
            type: device.type,
            platform: device.platform,
            info: device.info,
            config: device.config,
            apiLevel: device.apiLevel
        };
    }

    private static convertIDeviceToQuery(from: any) {
        let to: any = {};
        Object.getOwnPropertyNames(from).forEach((prop) => {
            if (from[prop]) {
                const propName = prop.startsWith('_') ? prop.replace('_', '') : prop;
                //const propName = prop.startsWith("_") ? prop : "_" + prop;
                to[propName] = from[prop];
            }
        });

        return to;
    }

    private increaseDevicesUsage(device: IDevice) {
        if (!this._usedDevices.has(device.token)) {
            this._usedDevices.set(device.token, 0);
        }
        const counter = this._usedDevices.get(device.token) + 1;
        this._usedDevices.set(device.token, counter);
    }

    private resetUsage(device: IDevice) {
        this._usedDevices.set(device.token, 0);
    }

    private checkDeviceUsageHasReachedLimit(count: number, device: IDevice): boolean {
        if (this._usedDevices.has(device.token) === false || this._usedDevices.get(device.token) === 0) {
            return false;
        }

        return this._usedDevices.get(device.token) >= count ? true : false;
    }

    private isAndroid(device) {
        return device.platform === Platform.ANDROID || device.type === DeviceType.EMULATOR;
    }

    private isIOS(device) {
        return device.platform === Platform.IOS || device.type === DeviceType.SIMULATOR;
    }
}
