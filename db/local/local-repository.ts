import { IRepository } from '../interfaces/repository';
import {
    fileExists,
    fileInfo,
    mkDir,
    resolveFiles,
    removeFilesRecursive
} from "../../lib/utils";
import {
    DeviceController,
    IDevice,
    AndroidController,
    IOSController,
    Platform,
    Status
} from 'mobile-devices-controller';

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

    public async update(item: string, obj: T) {
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

    // Defines device status according to the file. 
    private setDiveceStatus(device: IDevice): IDevice {
        let tempFileLocation = undefined;

        // What if this is a real device
        if (device.status !== Status.SHUTDOWN && device.status !== Status.INVALID && device.status !== Status.UNAUTORIZED) {
            if (device.platform === Platform.IOS) {
                tempFileLocation = `${IOSController.getSimLocation(device.token)}/data/tmp/used.tmp`;
            } else {
                const tempFolder = resolveFiles("./", device.name);
                tempFileLocation = AndroidController.pullFile(device, "/data/local/tmp/used.tmp", resolveFiles(tempFolder, "used.tmp"));
            }
        }

        if (fileExists(tempFileLocation)) {

            // Change this with json object
            const lastModified = fileInfo(tempFileLocation).mtime;
            const lastModifiedMiliSeconds = new Date(lastModified).getMilliseconds();
            console.log(`${device.token} is in use since ${this.timeSpan(Date.now(), lastModifiedMiliSeconds)}!`)
            device.status = Status.BUSY;
            device.info = `${device.token} is in use since ${this.timeSpan(Date.now(), lastModifiedMiliSeconds)}!`;
            return device;
        } else {
            console.log(`${device.name}:${device.token} is free!`);
            return device;
        }
    }

    private timeSpan(startTimeMiliSeconds: number, endTimeMiliSeconds: number) {
        const timespan = startTimeMiliSeconds - endTimeMiliSeconds;
        if (timespan !== NaN) {
            const time = new Date(timespan);
            return `${time.getHours}:${time.getMinutes}:${time.getSeconds}`;
        }
        return "";
    }
}
