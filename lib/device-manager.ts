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
import { Stats } from "fs";

export class DeviceManager {

    private _usedDevices: Map<string, number>;

    constructor(private _unitOfWork: IUnitOfWork, private _useLocalRepository = true) {
        this._usedDevices = new Map<string, number>();
    }

    public async boot(query, count, shouldUpdate = true) {
        if (!query.platform) {
            query.platform = query.platform ? query.platform : (query.type === DeviceType.EMULATOR ? Platform.ANDROID : Platform.IOS);
        }
        let simulators = await this._unitOfWork.devices.find(query);

        const maxDevicesToBoot = Math.min(simulators.length, parseInt(count || 1));
        const startedDevices = new Array<IDevice>();
        for (var index = 0; index < maxDevicesToBoot; index++) {
            let device: IDevice = simulators[index];
            device = await DeviceController.startDevice(device);
            if (shouldUpdate) {
                const result = await this._unitOfWork.devices.update(device.token, device);
            }
            startedDevices.push(device);
        }

        return startedDevices;
    }

    public async subscribeForDevice(query): Promise<IDevice> {
        const shouldRestartDevice = false || query.restart;
        delete query.restart;
        let searchQuery: IDevice = DeviceManager.convertIDeviceToQuery(query);
        delete searchQuery.info;
        searchQuery.status = Status.BOOTED;

        // get already booted device in order to reuse
        let device = await this._unitOfWork.devices.findSingle(searchQuery);
        if (shouldRestartDevice && device) {
            DeviceController.kill(device);
            device = undefined;
        }
        let maxDevicesCount = ((query.type === DeviceType.EMULATOR || query.platform === Platform.ANDROID) ? process.env['MAX_EMU_COUNT'] : process.env['MAX_SIM_COUNT']) || 1;

        if (!device) {
            searchQuery.status = Status.BUSY;

            let currentQueryProperty: any = {};
            if (query['platform']) {
                currentQueryProperty["platform"] = query["platform"];
            } else {
                currentQueryProperty["type"] = query["type"];;
            }
            currentQueryProperty["status"] = Status.BUSY;
            const busyDevicesCount = (await this._unitOfWork.devices.find(currentQueryProperty)).length;
            if (busyDevicesCount > maxDevicesCount) {
                throw new Error("MAX DEVICE COUNT REACHED!!!");
            }

            currentQueryProperty["status"] = Status.BOOTED;
            const bootedDevices = (await this._unitOfWork.devices.find(currentQueryProperty));
            const shouldKillDevice = bootedDevices && bootedDevices.length > 0 && (bootedDevices.length === maxDevicesCount);
            searchQuery.status = Status.SHUTDOWN;
            device = await this._unitOfWork.devices.findSingle(searchQuery);

            if (device) {
                device.info = query.info;
                const update = await this.mark(device);
                device.busySince = update.busySince;
                device.status = <Status>update.status;
                const deviceToBoot: IDevice = {
                    token: device.token,
                    type: device.type,
                    name: device.name,
                    apiLevel: device.apiLevel,
                    platform: device.platform
                };
                const bootedDevice = (await this.boot(deviceToBoot, 1, false))[0];
                device.token = bootedDevice.token;
                device.startedAt = bootedDevice.startedAt;
                device.busySince = bootedDevice.startedAt;
                device.status = bootedDevice.status;
                device.pid = bootedDevice.pid;
                this.resetUsage(device);
                if (shouldKillDevice) {
                    this.killDevice(bootedDevices[0]);
                    const upQuery: any = { 'status': Status.SHUTDOWN };
                    await this._unitOfWork.devices.update(bootedDevices[0].token, upQuery);
                }

                if (!device) {
                    delete searchQuery.status;
                    await this.unmark(searchQuery);
                }
            }
        }

        if (device) {
            device.info = query.info;
            const update = await this.mark(device);
            device.busySince = update.busySince;
            device.status = update.status;
            await this._unitOfWork.devices.update(device.token, device);
            device = await this._unitOfWork.devices.findByToken(device.token);
            this.increaseDevicesUsage(device);
            if ((device.platform === Platform.ANDROID || device.type === DeviceType.EMULATOR) && this.checkDeviceUsageHasReachedLimit(5, device)) {
                AndroidController.reboot(device);
                console.log(`On: ${new Date(Date.now())} device: ${device.name} ${device.token} is rebooted!`);
                this.resetUsage(device);
            }
        } else {
            device = await this.unmark(device);
        }
        if (device && device.type === DeviceType.EMULATOR || device.platform === Platform.ANDROID) {
            if(AndroidController.checkApplicationNotRespondingDialogIsDisplayed(device)){
                AndroidController.reboot(device);
                console.log(`On: ${new Date(Date.now())} device: ${device.name} ${device.token} is rebooted!`);                
            }
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

        if (!query || (!query.type && !query.platform)) {
            await this._unitOfWork.devices.dropDb();
            IOSController.killAll();
            await this.refreshData({ platform: Platform.IOS }, updateQuery);
            AndroidController.killAll();
            await this.refreshData({ platform: Platform.ANDROID }, updateQuery);
            return this._unitOfWork.devices.find(updateQuery);
        } else if (query) {
            if (Object.getOwnPropertyNames(query).length === 1 && (query.platform === Platform.IOS || query.type === DeviceType.SIMULATOR)) {
                IOSController.killAll();
                query.platform = Platform.IOS;
                query.type = DeviceType.SIMULATOR;
            } else if (Object.getOwnPropertyNames(query).length === 1 && (query.platform === Platform.IOS || query.type === DeviceType.SIMULATOR)) {
                AndroidController.killAll();
                query.platform = Platform.ANDROID;
                query.type = DeviceType.EMULATOR;
            } else {
                const devices = await this._unitOfWork.devices.find(query);
                devices.forEach(async (device) => {
                    await DeviceController.kill(device);
                    const log = await this._unitOfWork.devices.update(device.token, updateQuery);
                });
            }
            await this.refreshData(query, updateQuery);
        }
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
}