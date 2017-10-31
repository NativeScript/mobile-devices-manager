import { IRepository } from "./repository";
import { IDevice } from "../../models/interfaces/device";
import { IUser } from "../../models/interfaces/user";

export interface IUnitOfWork {
    devices: IRepository<IDevice>;
    //users: IRepository<IUser>;
}