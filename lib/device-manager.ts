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
        const searchQuery: IDevice = DeviceManager.convertIDeviceToQuery(query);
        delete searchQuery.info;
        searchQuery.status = Status.BOOTED;

        const queryByType: any = {};
        queryByType["platform"] = query.platform["platform"];
        if (!queryByType["platform"]) {
            delete queryByType["platform"];
            queryByType["type"] = query.platform["type"];
        }
        let bootedDevices = await this._unitOfWork.devices.find(queryByType);
        const maxDevicesCount = ((query.type === DeviceType.EMULATOR || query.platform === Platform.ANDROID) ? process.env['MAX_EMU_COUNT'] : process.env['MAX_SIM_COUNT']) || 1;

        if (bootedDevices.length >= maxDevicesCount) {
            bootedDevices.forEach(async device => {
                if (this.checkDeviceUsageHasReachedLimit(this.maxDeviceUsage, device)) {
                    if (query.restart && device) {
                        log("Kill and reboot device", device);
                        await DeviceController.kill(device);
                        if (this.isAndroid(device)) {
                            const avdsDirectory = process.env["AVDS_STORAGE"] || "$HOME/.android/avd";
                            const avd = resolve(avdsDirectory, `${device.name}.avd`);
                            getAllFileNames(avd).filter(f => f.endsWith(".lock")).forEach(f => {
                                rmdirSync(f);
                            });
                        }

                        this.resetUsage(device);
                    }
                }
            });
            
            bootedDevices = await this._unitOfWork.devices.find(queryByType);
        }

        let device: any = bootedDevices.length > 0 ? bootedDevices[0] : undefined;
        if (this.isAndroid(device)
            && (this.checkDeviceUsageHasReachedLimit(this.maxDeviceRebootCycles, device) || AndroidController.checkApplicationNotRespondingDialogIsDisplayed(device))) {
            AndroidController.reboot(device);
            log(`Device: ${device.name}/ ${device.token} is rebooted!`);
            this.resetUsage(device);
        }

        if (!device) {
            searchQuery.status = Status.SHUTDOWN;
            device = await this._unitOfWork.devices.findSingle(searchQuery);

            if (device) {
                const bootedDevice = (await this.boot({ token: device.token }, 1, false))[0];
                if (!bootedDevice) {
                    delete searchQuery.status;
                    await this.unmark(searchQuery);
                    log(`Failed to boot device! Result: `, bootedDevice);
                    throw Error("Failed to boot device!!!");
                }

                device.startedAt = bootedDevice.startedAt;
                device.busySince = bootedDevice.startedAt;
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

            await this._unitOfWork.devices.update(device.token, device);
            device = await this._unitOfWork.devices.findByToken(device.token);
            this.increaseDevicesUsage(device);
        } else {
            device = await this.unmark(device);
        }

        return <IDevice>device;
    }

    public async unsubscribeFromDevice(query): Promise<IDevice> {
        const device = await this._unitOfWork.devices.findByToken(query.token);
        if (device) {
            device.busySince = -1;
            device.info = undefined;
            if (device.status !== Status.SHUTDOWN) {
                device.status = Status.BOOTED;
            }

            return await this.unmark(device);
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
            const devices = await this._unitOfWork.devices.find(query);
            devices.forEach(async (device) => {
                await DeviceController.kill(device);
                const log = await this._unitOfWork.devices.update(device.token, updateQuery);
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
                const parsedDevices = await DeviceController.getDevices(query);

                const devices = new Array();
                parsedDevices.forEach(device => {
                    devices.push(DeviceManager.deviceToJSON(device));
                });

                await this._unitOfWork.devices.deleteMany(query);
                await this._unitOfWork.devices.addMany(devices);
                const result = await this._unitOfWork.devices.find(updateQuery);

                resolve(result);
            };
        });
    }

    public async dropdb() {
        await this._unitOfWork.devices.dropDb();
        return await this.refreshData({}, {});
    }

    public async update(token, udpateQuery) {
        return await this._unitOfWork.devices.update(token, udpateQuery)
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
        await DeviceController.kill(device);
        const updateQuery: any = {};
        updateQuery['status'] = Status.SHUTDOWN;
        updateQuery['startedAt'] = -1;
        updateQuery['busySince'] = -1;
        const log = await this._unitOfWork.devices.update(device.token, updateQuery);
    }

    private async mark(query): Promise<{ status: Status, busySince: number }> {
        const searchQuery: any = {};
        searchQuery['token'] = query.token;
        searchQuery['status'] = Status.BUSY;
        searchQuery['busySince'] = Date.now();
        const result = await this._unitOfWork.devices.update(searchQuery.token, searchQuery);
        return searchQuery;
    }

    private async unmark(query) {
        if (!query || !query['token']) {
            return;
        }
        const searchQuery: IDevice = query;
        searchQuery.token = query.token;
        searchQuery.busySince = -1;
        searchQuery.info = undefined;
        if (query.status) {
            searchQuery.status = query.status;
        } else {
            searchQuery.status = Status.BOOTED;
        }
        const result = await this._unitOfWork.devices.update(searchQuery.token, searchQuery);

        const device = await this._unitOfWork.devices.findByToken(query.token);
        return device;
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
