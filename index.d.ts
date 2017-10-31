import { DeviceManager } from "./lib/device-manager";
export { IUnitOfWork } from "./db/interfaces/unit-of-work";
export { LocalUnitOfWork } from "./db/local/local-unit-of-work";
export { MongoUnitOfWork } from "./db/mongo/mongodb-unit-of-work";
export { IRepository } from "./db/interfaces/repository";
export { DeviceManager } from "./lib/device-manager";
export declare function getDeviceManager(repositoy?: any): Promise<DeviceManager>;
