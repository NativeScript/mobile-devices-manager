import { IRepository } from '../interfaces/repository';
import {
    fileExists,
    fileInfo,
    mkDir,
    mkFile,
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

const fileName = "info.json";

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
            filteredDevices = devices.filter((device) => this.setDiveceStatus(device));
        } else {
            filteredDevices = devices;
        }

        return filteredDevices;
    }

    public async update(item: string, obj: any) {
        const devices = await DeviceController.getDivices({ token: item });
        if (devices && devices.length > 0) {
            LocalRepository.setInfo(<IDevice>obj);
        }
        // This method should create file.json where we should store the data given by update
        // Basically if there is already such a file we need to update it if not create and update
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
        device.status = LocalRepository.getInfo(device).status;
    }

    private static getInfo(device: IDevice): IDevice {
        let tempFileLocation = undefined;

        // What if this is a real device
        if (device.platform === Platform.IOS) {
            tempFileLocation = `${IOSController.getSimLocation(device.token)}/data/tmp/${fileName}`;
        } else {
            const tempFolder = resolveFiles("./", device.name);
            if (!fileExists(tempFolder)) {
                mkDir(tempFolder);
            }
            tempFileLocation = AndroidController.pullFile(device, `/data/local/tmp/${fileName}`, resolveFiles(tempFolder, fileName));
            if (!fileExists(tempFileLocation)) {
                removeFilesRecursive(tempFolder);
            }
        }

        // in case there is no file it means that the device is not booted and it should not contain file
        if (!fileExists(tempFileLocation) && !device.status) {
            device.status = Status.SHUTDOWN;
        } else {
            device = <IDevice>readJsonFromFile(tempFileLocation);
        }

        return device;
    }

    private static setInfo(device: IDevice) {
        if (device.platform === Platform.IOS) {
            const tempFileLocation = `${IOSController.getSimLocation(device.token)}/data/tmp/${fileName}`;
            if (device.status === Status.SHUTDOWN) {
                removeFilesRecursive(tempFileLocation);
            } else {
                writeFileToJson(tempFileLocation, (<Device>device).toJson());
            }
        } else {
            if (device.status === Status.SHUTDOWN) {
                return;
            }
            const tempFolder = resolveFiles("./", device.name);
            if (!fileExists(tempFolder)) {
                mkDir(tempFolder);
            }
            const tempFile = resolveFiles(tempFolder, fileName);
            writeFileToJson(tempFile, (<Device>device).toJson());
            const tempFileLocation = AndroidController.pushFile(device, tempFile, `/data/local/tmp/${fileName}`);
            if (fileExists(tempFileLocation)) {
                removeFilesRecursive(tempFolder);
            }
        }
    }

    // Defines device status according to the file. 
    // private setDiveceStatus(device: IDevice): IDevice {
    //     let tempFileLocation = undefined;

    //     // What if this is a real device
    //     if (device.status !== Status.SHUTDOWN && device.status !== Status.INVALID && device.status !== Status.UNAUTORIZED) {
    //         if (device.platform === Platform.IOS) {
    //             tempFileLocation = `${IOSController.getSimLocation(device.token)}/data/tmp/used.tmp`;
    //         } else {
    //             const tempFolder = resolveFiles("./", device.name);
    //             tempFileLocation = AndroidController.pullFile(device, "/data/local/tmp/used.tmp", resolveFiles(tempFolder, "used.tmp"));
    //         }
    //     }

    //     if (fileExists(tempFileLocation)) {

    //         // Change this with json object
    //         const lastModified = fileInfo(tempFileLocation).mtime;
    //         const lastModifiedMiliSeconds = new Date(lastModified).getMilliseconds();
    //         console.log(`${device.token} is in use since ${this.timeSpan(Date.now(), lastModifiedMiliSeconds)}!`)
    //         device.status = Status.BUSY;
    //         device.info = `${device.token} is in use since ${this.timeSpan(Date.now(), lastModifiedMiliSeconds)}!`;
    //         return device;
    //     } else {
    //         console.log(`${device.name}:${device.token} is free!`);
    //         return device;
    //     }
    // }

    // private timeSpan(startTimeMiliSeconds: number, endTimeMiliSeconds: number) {
    //     const timespan = startTimeMiliSeconds - endTimeMiliSeconds;
    //     if (timespan !== NaN) {
    //         const time = new Date(timespan);
    //         return `${time.getHours}:${time.getMinutes}:${time.getSeconds}`;
    //     }
    //     return "";
    // }
}
