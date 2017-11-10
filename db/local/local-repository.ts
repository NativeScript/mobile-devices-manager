import { IRepository } from '../interfaces/repository';
import {
    fileExists,
    fileInfo,
    mkDir,
    writeFileToJson,
    readJsonFromFile,
    resolveFiles,
    removeFilesRecursive
} from "../../lib/utils";
import {
    IDevice,
    Device,
    AndroidController,
    IOSController,
    DeviceController,
    Platform,
    Status,
    DeviceType
} from 'mobile-devices-controller';

const DEVICE_INFO_PACKAGE_JSON = "info.json";
const DEVICES_INFO_DIR = "~/devices-info"

export class LocalRepository<T> implements IRepository<T> {

    constructor() {
    }

    public async find(query): Promise<Array<T>> {
        const devices = await this.filter(query);

        const idevices = new Array();
        devices.forEach(device => {
            idevices.push(device);
        });

        return idevices;
    }

    public async findSingle(item: any): Promise<T> {
        const devices = await this.find(item);
        return devices.length > 0 ? devices[0] : null;
    }

    private async filter(query: any) {
        const devices = await DeviceController.getDivices(query);
        let filteredDevices = null;
        if (query.status) {
            filteredDevices = devices.filter((device) => {
                LocalRepository.getInfo(device);
                return device.status === query.status;
            });
        } else {
            filteredDevices = devices;
        }

        return filteredDevices;
    }

    public async update(token: string, obj: any) {
        const devices = await DeviceController.getDivices({ "token": token });
        if (devices && devices.length > 0) {
            LocalRepository.setInfo(obj);
        }
    }

    public async add(item: T) {
        // not sure but could be implement if we want to create new iPhone
    }

    public async remove(item) {
        // when we want to delete simulator or emulator
    }

    public dropDb() {
        return null;
    }

    private setDiveceStatus(device: IDevice) {
        const status = LocalRepository.getInfo(device);
        device.status = status.status ? status.status : Status.SHUTDOWN;
    }

    private static getInfo(device: IDevice): IDevice {
        const storage = LocalRepository.getStorageDir(device.token);
        if (!storage || !fileExists(storage)) {
            DeviceController.kill(device);
            device.status = Status.SHUTDOWN;

            return device;
        }

        const fileInfo = resolveFiles(storage, DEVICE_INFO_PACKAGE_JSON);
        if (!fileInfo || !fileExists(fileInfo)) {
            DeviceController.kill(device);
            device.status = Status.SHUTDOWN;

            return device;
        }

        return <IDevice>readJsonFromFile(fileInfo);
    }

    private static setInfo(device: IDevice): IDevice {
        const storage = LocalRepository.getStorageDir(device.token);
        if (!storage || !fileExists(storage)) {
            DeviceController.kill(device);
            mkDir(storage);
        }

        if (device.status === Status.SHUTDOWN) {
            removeFilesRecursive(storage);
            return device;
        }

        LocalRepository.writeToStorage(device);
    }

    private static writeToStorage(device: IDevice) {
        const tempFile = LocalRepository.getStorageDir(device.token);
        const fileInfo = resolveFiles(tempFile, DEVICE_INFO_PACKAGE_JSON);
        const json = LocalRepository.copyProperties(device).toJson();
        writeFileToJson(fileInfo, json);
    }

    private static copyProperties(from: any) :Device {
        const to: Device = new Device(undefined, undefined, undefined, undefined, undefined, undefined);
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

    private static getStorageDir(token: string) {
        const locaTempStorage = resolveFiles(DEVICES_INFO_DIR, token);
        return locaTempStorage;
    }

    private createStorage(token: string) {
        const locaTempStorage = resolveFiles(DEVICES_INFO_DIR, token);
        if (!fileExists(locaTempStorage)) {
            mkDir(locaTempStorage);
        }
        return locaTempStorage;
    }
}
