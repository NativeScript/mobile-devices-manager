import { IRepository } from "./repository";
import { IDevice } from "../../models/interfaces/device";
export interface IUnitOfWork {
    devices: IRepository<IDevice>;
}
