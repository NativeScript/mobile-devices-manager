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

export class DeviceManager {

    constructor(private _unitOfWork: IUnitOfWork, private _useLocalRepository = true) {
    }

    public async boot(query, count) {
        query.status = Status.SHUTDOWN;
        query.platform = query.platform ? query.platform : (query.type === DeviceType.EMULATOR ? Platform.ANDROID : Platform.IOS);
        let simulators =
            await this._unitOfWork.devices.find(query);

        const maxDevicesToBoot = Math.min(simulators.length, parseInt(count || 1));
        const startedDevices = new Array<IDevice>();
        for (var index = 0; index < maxDevicesToBoot; index++) {
            let device: IDevice = simulators[index];
            device = await DeviceController.startDevice(device);
            const result = await this._unitOfWork.devices.update(device.token, device);
            startedDevices.push(device);
        }

        return startedDevices;
    }

    public async subscribeDevice(query): Promise<IDevice> {
        let searchQuery: IDevice = DeviceManager.copyProperties(query);
        delete searchQuery.info;
        searchQuery.status = Status.BOOTED;

        // searching for already booted devices
        let device = await this._unitOfWork.devices.findSingle(searchQuery);
        if (device) {
            device.info = query.info;
            await this.mark(device);
            return device;
        }

        let busyDevices = 0;
        let count = (query.type === DeviceType.EMULATOR || query.platform === Platform.ANDROID) ? process.env['MAX_EMU_COUNT'] : process.env['MAX_SIM_COUNT'] || 1;

        if (!device || device === null) {

            searchQuery.status = Status.BUSY;
            busyDevices = (await this._unitOfWork.devices.find(searchQuery)).length;

            if (busyDevices < count) {
                searchQuery.status = Status.SHUTDOWN;
                device = await this._unitOfWork.devices.findSingle(searchQuery);
                if (device) {
                    device.info = query.info;
                    await this.mark(device);
                    device.info = undefined;
                    device = (await this.boot(device, 1))[0];
                }

                if (!device) {
                    await this.unmark(searchQuery);
                }
            }
        }

        if (device || device !== null && busyDevices < count) {
            device.info = query.info;            
            device = await this.mark(query);
        }else{
            device = await this.mark(query);
        }

        return device;
    }

    public async unSubscribeDevice(query): Promise<IDevice> {
        const device = await this._unitOfWork.devices.findSingle(query.token);
        device.busySince = -1;
        device.info = undefined;
        device.status = Status.BOOTED;
        const result = await this._unitOfWork.devices.update(device.token, device);

        return result;
    }

    /// should be tested. 
    public async update(searchQuery, udpateQuery) {
        const searchedObj = {};
        searchQuery.split("&").forEach(element => {
            let delimiter = "="
            if (element.includes(":")) {
                delimiter = ":";
            }

            const args = element.split(delimiter);
            searchedObj[args[0]] = args[1];
        });

        const simulators = await this._unitOfWork.devices.find(<IDevice>searchedObj);
        const updatedSimulators = new Array();
        for (var index = 0; index < simulators.length; index++) {
            const sim = simulators[index];
            await this._unitOfWork.devices.update(sim.token, udpateQuery)
            updatedSimulators.push(await this._unitOfWork.devices.find(<IDevice>{ "token": sim.token }));
        }

        return updatedSimulators;
    }

    public async killDevices(query?) {
        if (!query || (!query.type && query.platform)) {
            await this._unitOfWork.devices.dropDb();
            IOSController.killAll();
            AndroidController.killAll();
            this.refreshDb(query);
        } else if (query) {
            if (Object.getOwnPropertyNames(query).length === 2 && query.platform === Platform.IOS || query.type === DeviceType.SIMULATOR) {
                IOSController.killAll();
            } else if (Object.getOwnPropertyNames(query).length === 2 && query.platform === Platform.IOS || query.type === DeviceType.SIMULATOR) {
                AndroidController.killAll();
            } else {
                const devices = await this._unitOfWork.devices.find(query);
                devices.forEach(async (device) => {
                    await DeviceController.kill(device);
                    device.status = Status.SHUTDOWN;
                    device.startedAt = -1;
                    device.busySince = -1;
                    const query: any = (<Device>device).toJson();
                    const log = await this._unitOfWork.devices.update(device.token, query);
                });
            }
        }
    }

    public async refreshData(query?) {
        if (!this._useLocalRepository) {
            await this._unitOfWork.devices.remove(query);
            this.refreshDb(query);
        }

        const devices = await this._unitOfWork.devices.find(query);

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
        const searchQuery: IDevice = DeviceManager.copyProperties(query);
        searchQuery.status = Status.BUSY;
        searchQuery.busySince = Date.now();
        searchQuery.info = query.info;

        const result = await this._unitOfWork.devices.update(searchQuery.token, searchQuery);

        return searchQuery;
    }

    private async unmark(query) {
        const searchQuery: IDevice = DeviceManager.copyProperties(query);
        searchQuery.busySince = -1;
        searchQuery.info = undefined;
        searchQuery.status = Status.SHUTDOWN;
        const result = await this._unitOfWork.devices.update(searchQuery.token, searchQuery);

        return result;
    }

    private async refreshDb(query) {
        if (this._useLocalRepository) {
            return;
        }
        (await DeviceController.getDivices(query)).forEach(async (device) => {
            await this.createModel(device);
        });
    }

    private async createModel(device: IDevice) {
        await this._unitOfWork.devices.add({
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

    private static copyProperties(from: IDevice, to: IDevice = { platform: undefined, token: undefined, name: undefined, type: undefined }) {
        Object.getOwnPropertyNames(from).forEach((prop) => {
            if (from[prop]) {
                const propName = prop.startsWith('_') ? prop.replace('_', '') : prop;
                to[propName] = from[prop];
            }
        });

        Object.getOwnPropertyNames(to).forEach((prop) => {
            if (!to[prop]) {
                delete to[prop];
            }
        });
        return to;
    }
}