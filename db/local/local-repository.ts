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
import { Stats } from 'fs';

const DEVICE_INFO_PACKAGE_JSON = "info.json";
const DEVICES_INFO_DIR = "~/devices-info"

export class LocalRepository<T> implements IRepository<T> {

    constructor() {
        this.dropDb();
    }

    public async find(query): Promise<Array<T>> {
        const devices = await this.filter(query);

        const idevices = new Array();
        devices.forEach(device => {
            idevices.push(LocalRepository.convertIDeviceToQuery(device));
        });

        return idevices;
    }

    public async findByToken(token): Promise<T> {
        const devices = await this.find({ token: token });
        return devices.length > 0 ? devices[0] : null;
    }

    public async findSingle(item: any): Promise<T> {
        const devices = await this.find(item);
        return devices.length > 0 ? devices[0] : null;
    }

    private async filter(query: any) {
        const status = query ? query.status : undefined;
        const check = status === Status.BUSY;
        if (check) {
            query.status = Status.BOOTED;
        }
        const devices = await DeviceController.getDevices(query);
        query.status = status;
        let filteredDevices = new Array();
        devices.forEach((device) => {
            // console.log("DEVCIE", device);
            const d = LocalRepository.getInfo(device);
            device.status = d.status || d['_status'];
            if (query && query.status && device.status === query.status) {
                filteredDevices.push(d);
            } else if (!query || !query.status) {
                filteredDevices.push(d);
            }
        });

        return filteredDevices;
    }

    public async update(token: string, obj: any) {
        const devices = await DeviceController.getDevices({ "token": token });
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
        removeFilesRecursive(resolveFiles(DEVICES_INFO_DIR));

        return null;
    }

    private setDiveceStatus(device: IDevice) {
        const status = LocalRepository.getInfo(device);
        device.status = status.status ? status.status : Status.SHUTDOWN;
    }

    private static getInfo(device: IDevice): IDevice {
        const storage = LocalRepository.getStorageDir(device.token);
        if (!storage || !fileExists(storage) || device.status === Status.SHUTDOWN) {
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
            mkDir(storage);
        }

        if (device.status === Status.SHUTDOWN) {
            DeviceController.kill(device);
            removeFilesRecursive(storage);
            return device;
        }

        LocalRepository.writeToStorage(device);
    }

    private static writeToStorage(device: IDevice) {
        const tempFile = LocalRepository.getStorageDir(device.token);
        const fileInfo = resolveFiles(tempFile, DEVICE_INFO_PACKAGE_JSON);
        const json = LocalRepository.copyProperties(device);
        writeFileToJson(fileInfo, json);
    }

    private static copyProperties(from: any): Device {
        const to: Device = new Device(undefined, undefined, undefined, undefined, undefined, undefined);
        Object.getOwnPropertyNames(from).forEach((prop) => {
            if (from[prop]) {
                const propName = prop.startsWith('_') ? prop.replace('_', '') : prop;
                //const propName = prop.startsWith("_") ? prop : "_" + prop;
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
