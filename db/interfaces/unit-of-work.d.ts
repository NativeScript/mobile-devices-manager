import { IRepository } from "./repository";
import { IDevice } from "mobile-devices-controller";
export interface IUnitOfWork {
    devices: IRepository<IDevice>;
}
