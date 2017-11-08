import { IUnitOfWork } from "../interfaces/unit-of-work";
import { IRepository } from "../interfaces/repository";
import { IDevice } from "mobile-devices-controller";
export declare class MongoUnitOfWork implements IUnitOfWork {
    private _devices;
    private _context;
    constructor(connectionString?: string);
    readonly devices: IRepository<IDevice>;
}
