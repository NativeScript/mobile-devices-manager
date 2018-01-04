import { IUnitOfWork } from "../interfaces/unit-of-work";
import { IRepository } from "../interfaces/repository";
import { IDeviceModel } from "../interfaces/device-model";
export declare class MongoUnitOfWork implements IUnitOfWork {
    private _devices;
    private _context;
    constructor(connectionString?: string);
    readonly devices: IRepository<IDeviceModel>;
}
