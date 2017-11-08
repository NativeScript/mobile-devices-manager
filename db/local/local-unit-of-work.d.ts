import { IUnitOfWork } from "../interfaces/unit-of-work";
import { IRepository } from "../interfaces/repository";
import { IDevice } from "mobile-devices-controller";
export declare class LocalUnitOfWork implements IUnitOfWork {
    private _devices;
    constructor();
    readonly devices: IRepository<IDevice>;
}
