import { IUnitOfWork } from "../interfaces/unit-of-work";
import { IRepository } from "../interfaces/repository";
import { LocalRepository } from "./local-repository";
import { IDevice } from "mobile-devices-controller";

export class LocalUnitOfWork implements IUnitOfWork {
    private _devices: IRepository<IDevice>;

    constructor() {
    }

    get devices(): IRepository<IDevice> {
        if (!this._devices) {
            this._devices = new LocalRepository<IDevice>();
        }
        return this._devices;
    }
}