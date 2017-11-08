import * as constantns from "./lib/parser";
import { IUnitOfWork } from "./db/interfaces/unit-of-work";
import { LocalUnitOfWork } from "./db/local/local-unit-of-work";
import { MongoUnitOfWork } from "./db/mongo/mongodb-unit-of-work";
import { IRepository } from "./db/interfaces/repository";
import { DeviceManager } from "./lib/device-manager";

export { IUnitOfWork } from "./db/interfaces/unit-of-work";
export { LocalUnitOfWork } from "./db/local/local-unit-of-work";
export { MongoUnitOfWork } from "./db/mongo/mongodb-unit-of-work";
export { IRepository } from "./db/interfaces/repository";
export { DeviceManager } from "./lib/device-manager";

export async function getDeviceManager(repositoy?) {
    const unitOfWork: IUnitOfWork = repositoy || constantns.localStorage ? new LocalUnitOfWork() : new MongoUnitOfWork();
    if (constantns.verbose) {
        console.log("",unitOfWork);
    }
    const deviceManager = new DeviceManager(unitOfWork);
    if (constantns.verbose) {
        console.log("",deviceManager);
    }
    return deviceManager;
}
