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
        query.platform = query.platform ? query.platform : (query.type === DeviceType.EMULATOR ? Platform.ANDROID : Platform.IOS);
        let simulators =
            await this._unitOfWork.devices.find(query);

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

    public async subscribeDevice(query): Promise<IDevice> {
        let searchQuery: IDevice = DeviceManager.copyProperties(query);
        delete searchQuery.info;
        searchQuery.status = Status.BOOTED;

        // searching for already booted devices
        let device = await this._unitOfWork.devices.findSingle(searchQuery);

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
                    const deviceToBoot: IDevice = DeviceManager.copyProperties(device);
                    delete deviceToBoot.status;
                    delete deviceToBoot.info;
                    delete deviceToBoot.busySince;
                    delete deviceToBoot.startedAt;
                    const bootedDevice = (await this.boot(deviceToBoot, 1, false))[0];
                    device.token = bootedDevice.token;
                    device.startedAt = bootedDevice.startedAt;
                    device.status = bootedDevice.status;
                    device.pid = bootedDevice.pid;
                }

                if (!device) {
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

    public async unSubscribeDevice(query): Promise<IDevice> {
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
        const updateQuery = DeviceManager.copyProperties(query);
        updateQuery.status = Status.SHUTDOWN;
        updateQuery.startedAt = -1;
        updateQuery.busySince = -1;

        const devices = await this._unitOfWork.devices.find(query);
        devices.forEach(async (device) => {
            await DeviceController.kill(device);

            const log = await this._unitOfWork.devices.update(device.token, updateQuery);
        });

        return devices;
    }

    public async refreshData(query, updateQuery) {
        if (this._useLocalRepository) {
            await this._unitOfWork.devices.dropDb();
        } else {
            (await DeviceController.getDivices(query)).forEach(async (device) => {
                const d = await this._unitOfWork.devices.findByToken(device.token);
                if (d) {
                    await this._unitOfWork.devices.update(device.token, updateQuery);
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
        if (!from) {
            return to;
        }
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