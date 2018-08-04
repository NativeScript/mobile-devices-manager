import { IUnitOfWork } from "../db/interfaces/unit-of-work";

import {
    AndroidController,
    IOSController,
    DeviceController,
    IDevice,
    Platform,
    DeviceType,
    Status
} from "mobile-devices-controller";
import { logInfo, logError, wait } from "./utils";
import { logWarn } from "./utils";

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
            logInfo("Should restart device flag passed!")
            this.killDevice(device);
            device = undefined;
        }

        if (!device) {
            this.resetDevicesCountToMaxLimitedCount(query);

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
                logWarn(`Rebooting device: ${device.name} ${device.token} on ${new Date(Date.now())}, since max usage limit per device reached!`);

                AndroidController.reboot(device);
                logInfo(`On: ${new Date(Date.now())} device: ${device.name} ${device.token} is rebooted!`);
                this.resetUsage(device);
            }
        } else {
            device = await this.unmark(device);
        }

        if (!device) {
            logError("Could not find device", searchQuery);
            return device;
        }

        if (device && device.type === DeviceType.EMULATOR || device.platform === Platform.ANDROID) {
            if (!AndroidController.checkIfEmulatorIsResponding(device)) {
                logWarn(`Rebooting device: ${device.name} ${device.token} on ${new Date(Date.now())} since error message is detected!`);
                AndroidController.reboot(device);
                logInfo(`On: ${new Date(Date.now())} device: ${device.name} ${device.token} is rebooted!`);
            }
        }

        wait(2000);
        return <IDevice>device;
    }

    public async unsubscribeFromDevice(query): Promise<IDevice> {
        const device = await this._unitOfWork.devices.findByToken(query.token);
        let result;
        if (device) {
            device.busySince = -1;
            device.info = undefined;
            if (device.status !== Status.SHUTDOWN) {
                device.status = Status.BOOTED;
            }

            result = await this.unmark(device);
        }

        this.resetDevicesCountToMaxLimitedCount(device);

        return result;
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
            for (let index = 0; index < devices.length; index++) {
                const element = devices[index];
                await this.killDevice(element);
            }
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

    private getMaxDeviceCount(query) {
        const maxDevicesCount = ((query.type === DeviceType.EMULATOR || query.platform === Platform.ANDROID) ? process.env['MAX_EMU_COUNT'] : process.env['MAX_SIM_COUNT']) || 1;
        return maxDevicesCount
    }

    private async resetDevicesCountToMaxLimitedCount(query) {
        const currentQueryProperty: any = {};
        if (query['platform']) {
            currentQueryProperty["platform"] = query["platform"];
        } else {
            currentQueryProperty["type"] = query["type"];;
        }

        const filteOptions = options => {
            Object.keys(options).forEach(key => !options[key] && delete options[key]);
            return options;
        };
        //let typeQuery: any = { platform: query.platform, type: query.type }
        //typeQuery = filteOptions(typeQuery);
        currentQueryProperty.status = Status.BOOTED;
        const bootedDevices = (await this._unitOfWork.devices.find(<any>currentQueryProperty));
        logInfo(`Booted device count: ${bootedDevices.length}`);

        currentQueryProperty.status = Status.BUSY;
        let busyDevices = (await this._unitOfWork.devices.find(<any>currentQueryProperty));
        logInfo(`Busy device count: ${busyDevices.length}`);

        let updateBusyDevices = false;
        for (let index = 0; index < busyDevices.length; index++) {
            const element = busyDevices[index];
            const twoHours =7200000;
            if (element.busySince && element.startedAt && element.startedAt - element.busySince > twoHours) {
                logWarn(`Killing device, since it has been BUSY more than ${twoHours}`);
                this.killDevice(element);
                updateBusyDevices = true;
            }
        }

        if (updateBusyDevices) {
            busyDevices = (await this._unitOfWork.devices.find(<any>currentQueryProperty));
            logInfo(`Busy device count after update: ${busyDevices.length}`);
        }

        const maxDevicesCount = this.getMaxDeviceCount(query);

        if (busyDevices.length > maxDevicesCount) {
            logInfo("MAX device count: ", maxDevicesCount);
            logError("MAX DEVICE COUNT REACHED!!!");
        }

        if (bootedDevices.length + busyDevices.length > maxDevicesCount) {
            logWarn(`Max device count reached!!! Devices count: ${bootedDevices.length + busyDevices.length} > max device count: ${maxDevicesCount}!!!`);
            const devicesToKill = new Array();
            bootedDevices.forEach(d => devicesToKill.push({ name: d.name, token: d.token }));
            if (bootedDevices.length > 0) {
                const result = devicesToKill.join("\n");
                logWarn(`Killing all booted device!!! `, result);
                for (let index = 0; index < bootedDevices.length; index++) {
                    const element = bootedDevices[index];
                    await this.killDevice(element);
                    wait(3000);
                }
            } else {
                logWarn(`No free devices to kill. Probably all devices are with status BUSY!!!`);
            }
        }
    }

    private async killDevice(device) {
        logWarn("Killing device", device);
        await DeviceController.kill(device);
        const updateQuery: any = {};
        updateQuery['status'] = Status.SHUTDOWN;
        updateQuery['startedAt'] = -1;
        updateQuery['busySince'] = -1;
        const log = await this._unitOfWork.devices.update(device.token, updateQuery);
        logInfo(`Update log`, log);
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