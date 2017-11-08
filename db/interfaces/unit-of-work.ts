import { IRepository } from "./repository";
import { IUser } from "../interfaces/user";
import { IDevice } from "mobile-devices-controller";

export interface IUnitOfWork {
    devices: IRepository<IDevice>;
    //users: IRepository<IUser>;
}