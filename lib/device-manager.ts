import * as d from "../models/interfaces/device";
import { IUnitOfWork } from "../db/interfaces/unit-of-work";

import {
    AndroidManager,
    IOSManager,
    Device,
    IDevice,
    Platform,
    DeviceType,
    Status
} from "mobile-devices-controller";

export class DeviceManager {

    constructor(private _unitOfWork: IUnitOfWork) {

    }

    public async bootDevices() {
        const simsCount = process.env.MAX_IOS_DEVICES_COUNT;
        const emusCount = process.env.MAX_ANDROID_DEVICES_COUNT;
        const simName = process.env.SIM_NAMES;
        const emuName = process.env.EMU_NAMES;
        let query = {
            "name": { "$regex": simName, "$options": "i" },
            "type": DeviceType.SIMULATOR,
        };
        await this.boot(query, simsCount);

        query.type = DeviceType.EMULATOR;
        await this.boot(query, emusCount);
    }

    public async boot(query, count) {
        query.status = Status.SHUTDOWN;
        let simulators = await this._unitOfWork.devices.find(query);

        const maxDevicesToBoot = Math.min(simulators.length, parseInt(count || 1));
        const startedDevices = new Array<d.IDevice>();
        for (var index = 0; index < maxDevicesToBoot; index++) {
            let device: d.IDevice = simulators[index];
            if (device.type === DeviceType.SIMULATOR) {
                device = await IOSManager.startSimulator(DeviceManager.copyIDeviceModelToDevice(device));
            } else if (device.type === DeviceType.EMULATOR) {
                device = await AndroidManager.startEmulator(DeviceManager.copyIDeviceModelToDevice(device));
            }
            const json = (<Device>device).toJson();
            const result = await this._unitOfWork.devices.update(device.token, json);
            startedDevices.push(device);
        }

        return startedDevices;
    }

    public async subscribeDevice(platform, deviceType, app, apiLevel, deviceName, count) {
        const status = Status.BOOTED;
        const searchQuery = {
            "platform": platform,
            "name": deviceName,
            "type": deviceType,
            "status": status,
            "apiLevel": apiLevel,
        };
        let device = await this._unitOfWork.devices.findSingle(searchQuery);
        count = (deviceType === Platform.ANDROID ? process.env.MAX_ANDROID_DEVICES_COUNT : process.env.MAX_IOS_DEVICES_COUNT) || 1
        let busyDevices = 0;
        if (!device || device === null) {
            searchQuery.status = Status.BUSY;
            busyDevices = (await this._unitOfWork.devices.find(searchQuery)).length;

            if (busyDevices < count) {
                device = (await this.boot(searchQuery, 1))[0];
                searchQuery.status = Status.BOOTED;
            }
        }

        let searchedDevice = null;

        if (device || device !== null && busyDevices < count) {
            const result = await this._unitOfWork.devices.update(device.token, {
                "status": Status.BUSY,
                "busySince": Date.now(),
                "info": app
            });

            const updatedDevice = await this._unitOfWork.devices.findSingle({ 'token': device.token });
            searchedDevice = DeviceManager.copyIDeviceModelToDevice(updatedDevice);
        }

        return searchedDevice;
    }

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

        const simulators = await this._unitOfWork.devices.find(searchedObj);
        const updatedSimulators = new Array();
        for (var index = 0; index < simulators.length; index++) {
            const sim = simulators[index];
            await this._unitOfWork.devices.update(sim.token, udpateQuery)
            updatedSimulators.push(await this._unitOfWork.devices.find({ "token": sim.token }));
        }

        return updatedSimulators;
    }

    public getIOSDevices() {
        return IOSManager.getAllDevices();
    }

    public getAndroidDevices() {
        return AndroidManager.getAllDevices();
    }

    public async killDevice(obj, _unitOfWork: IUnitOfWork) {
        const devices = await _unitOfWork.devices.find(obj);
        devices.forEach(async (device) => {
            await this.killDeviceSingle(device);
        });
    }

    public async killDeviceSingle(device: d.IDevice) {
        if (device.type === DeviceType.SIMULATOR || device.platform === Platform.IOS) {
            IOSManager.kill(device.token);
        } else {
            AndroidManager.kill(DeviceManager.copyIDeviceModelToDevice(device));
        }

        device.status = Status.SHUTDOWN;
        device.startedAt = -1;
        device.token = "";
        const tempQuery: any = (<Device>device).toJson();
        tempQuery.startedUsageAt = -1;
        tempQuery.holder = -1;

        const log = await this._unitOfWork.devices.update(device.token, (<Device>device).toJson());
        console.log(log);
    }

    public async killAll(type?: string) {
        if (!type) {
            await this._unitOfWork.devices.dropDb();

            IOSManager.killAll();
            await this.loadDBWithIOSDevices();

            AndroidManager.killAll();
            await this.loadDBWithAndroidDevices();
        } else {
            if (type.includes("ios")) {
                IOSManager.killAll();
                await this.loadDBWithIOSDevices();
            }

            if (type.includes("android")) {
                AndroidManager.killAll();
                await this.loadDBWithAndroidDevices();
            }
        }
    }

    public async refreshData(request?) {
        await this._unitOfWork.devices.remove(request);

        if (!request || !request.type || request.type.includes("ios")) {
            await this.loadDBWithIOSDevices();
        }

        if (!request || !request.type || request.type.includes("android")) {
            await this.loadDBWithAndroidDevices();
        }

        const devices = await this._unitOfWork.devices.find();

        return devices;
    }

    public checkDeviceStatus(maxUsageTime) {
        setInterval(async () => {
            const devices = await this._unitOfWork.devices.find({ "startedAt": "gt :0" });
            devices.forEach(async (device) => {
                const now = Date.now();
                if (now - device.startedAt > maxUsageTime) {
                    await this.killDeviceSingle(device);
                    await this.boot({ "name": device.name }, 1);
                }
            });
        }, 300000);
    }

    private static copyIDeviceModelToDevice(deviceModel: d.IDevice, device?: Device): IDevice {
        if (!device) {
            device = new Device(
                DeviceManager.stringObjToPrimitiveConverter(deviceModel.name),
                DeviceManager.stringObjToPrimitiveConverter(deviceModel.apiLevel),
                DeviceManager.stringObjToPrimitiveConverter(deviceModel.type),
                DeviceManager.stringObjToPrimitiveConverter(deviceModel.platform),
                DeviceManager.stringObjToPrimitiveConverter(deviceModel.token),
                DeviceManager.stringObjToPrimitiveConverter(deviceModel.status),
                deviceModel.pid);
            device.info = deviceModel.info;
            device.config = deviceModel.config;
            device.busySince = deviceModel.busySince;
            device.startedAt = deviceModel.startedAt;
        } else {
            device.name = DeviceManager.stringObjToPrimitiveConverter(deviceModel.name);
            device.pid = deviceModel.pid;
            device.startedAt = deviceModel.startedAt;
            device.status = DeviceManager.stringObjToPrimitiveConverter(deviceModel.status);
            device.token = DeviceManager.stringObjToPrimitiveConverter(deviceModel.token);
            device.type = DeviceManager.stringObjToPrimitiveConverter(deviceModel.type);
            device.platform = DeviceManager.stringObjToPrimitiveConverter(deviceModel.platform);
            device.apiLevel = DeviceManager.stringObjToPrimitiveConverter(deviceModel.apiLevel);
            device.info = DeviceManager.stringObjToPrimitiveConverter(deviceModel.info);
            device.config = DeviceManager.stringObjToPrimitiveConverter(deviceModel.config);
        }

        return device;
    }

    private static copyDeviceToIDeviceModel(device: Device, deviceModel: d.IDevice) {
        deviceModel.name = device.name;
        deviceModel.pid = device.pid;
        deviceModel.startedAt = device.startedAt;
        deviceModel.status = device.status;
        deviceModel.token = device.token;
        deviceModel.type = device.type;
        deviceModel.info = device.info;
        deviceModel.config = device.config;
        deviceModel.apiLevel = device.apiLevel;
    }

    private static stringObjToPrimitiveConverter(obj: String) {
        let value: any = undefined;
        if (obj) {
            value = obj + "";
        }
        return value;
    }

    private async loadDBWithAndroidDevices() {
        (await this.getAndroidDevices()).forEach(async (devices) => {
            devices.forEach(async (device) => {
                await this.createModel(device);
            });
        });
    }

    private loadDBWithIOSDevices() {
        this.getIOSDevices().forEach(async (devices) => {
            devices.forEach(async (device) => {
                await this.createModel(device);
            });
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
}