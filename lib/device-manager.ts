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
import { debug } from "util";
import { Stats } from "fs";

export class DeviceManager {

    constructor(private _unitOfWork: IUnitOfWork, private _useLocalRepository = true) {
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
        let searchQuery: IDevice = query;
        delete searchQuery.info;
        searchQuery.status = Status.BOOTED;

        // get already booted device in order to reuse
        let device = await this._unitOfWork.devices.findSingle(searchQuery);
        if (shouldRestartDevice && device) {
            DeviceController.kill(device);
            device = undefined;
        }
        let busyDevices = 0;
        let count = ((query.type === DeviceType.EMULATOR || query.platform === Platform.ANDROID) ? process.env['MAX_EMU_COUNT'] : process.env['MAX_SIM_COUNT']) || 1;

        if (!device || device === null) {
            searchQuery.status = Status.BUSY;
            busyDevices = (await this._unitOfWork.devices.find(searchQuery)).length;

            if (busyDevices < count) {
                searchQuery.status = Status.SHUTDOWN;
                device = await this._unitOfWork.devices.findSingle(searchQuery);
                if (device) {
                    device.info = query.info;
                    device = await this.mark(device);
                    const deviceToBoot: IDevice = {
                        token: device.token,
                        type: query.type,
                        name: device.name,
                        apiLevel: device.apiLevel,
                        platform: device.platform
                    };
                    const bootedDevice = (await this.boot(deviceToBoot, 1, false))[0];
                    device.token = bootedDevice.token;
                    device.startedAt = bootedDevice.startedAt;
                    device.status = bootedDevice.status;
                    device.pid = bootedDevice.pid;
                }

                if (!device) {
                    delete searchQuery.status;
                    await this.unmark(searchQuery);
                }
            }
        }

        if (device || device !== null && busyDevices < count) {
            device.info = query.info;
            device = await this.mark(device);
        } else if (device) {
            device = await this.unmark(device);
        }

        return device;
    }

    public async unsubscribeFromDevice(query): Promise<IDevice> {
        const device = await this._unitOfWork.devices.findByToken(query.token);
        if (device) {
            device.busySince = -1;
            device.info = undefined;
            if (device.status !== Status.SHUTDOWN) {
                device.status = Status.BOOTED;
            }
            await this._unitOfWork.devices.update(device.token, device);
        }

        return device;
    }

    /// should be tested. 
    public async update(token, udpateQuery) {
        return await this._unitOfWork.devices.update(token, udpateQuery)
    }

    public async killDevices(query?) {
        const updateQuery = DeviceManager.convertIDeviceToQuery(query);
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
            if (Object.getOwnPropertyNames(query).length === 1 && query.platform === Platform.IOS || query.type === DeviceType.SIMULATOR) {
                IOSController.killAll();
                query.platform = Platform.IOS;
                query.type = DeviceType.SIMULATOR;
            } else if (Object.getOwnPropertyNames(query).length === 1 && query.platform === Platform.IOS || query.type === DeviceType.SIMULATOR) {
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
        if (this._useLocalRepository) {
            await this._unitOfWork.devices.dropDb();
        } else {
            await (await DeviceController.getDevices(query)).forEach(async (device) => {
                const d = await this._unitOfWork.devices.findByToken(device.token);
                if (d) {
                    let udpateQueryCopy = updateQuery;
                    if(!udpateQueryCopy || !udpateQueryCopy.hasOwnProperty()){
                        udpateQueryCopy = device;
                        delete updateQuery.token;
                        delete updateQuery.name;
                        delete updateQuery.type;
                        delete updateQuery.apiLevel;
                    }
                    await this._unitOfWork.devices.update(device.token, udpateQueryCopy);
                } else {
                    await this.createModel(device);
                }
            });
        }

        const devices = await this._unitOfWork.devices.find(updateQuery);

        return devices;
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

    private async mark(query) {
        const searchQuery: IDevice = query;
        searchQuery.status = Status.BUSY;
        searchQuery.busySince = Date.now();
        searchQuery.info = query.info;

        const result = await this._unitOfWork.devices.update(searchQuery.token, searchQuery);

        return searchQuery;
    }

    private async unmark(query) {
        const searchQuery: IDevice = query;
        searchQuery.busySince = -1;
        searchQuery.info = undefined;
        searchQuery.status = Status.SHUTDOWN;
        const result = await this._unitOfWork.devices.update(searchQuery.token, searchQuery);

        return searchQuery;
    }

    private async createModel(device: IDevice) {
        return await this._unitOfWork.devices.add({
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
        });
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
}