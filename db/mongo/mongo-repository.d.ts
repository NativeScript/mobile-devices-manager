import { Model, Document } from "mongoose";
import { IRepository } from "../interfaces/repository";
export declare class MongoRepository<T extends Document> implements IRepository<T> {
    private _entitySet;
    constructor(entities: Model<T>);
    add(item: T): Promise<T>;
    find(query: T): Promise<Array<T>>;
    findByToken(token: any): Promise<T>;
    findSingle(query: any): Promise<T>;
    update(token: string, values: T): Promise<any>;
    remove(item: any): Promise<void>;
    dropDb(): Promise<void>;
    private static copyIDeviceModelToDevice(deviceModel, device?);
    private static copyDeviceToIDeviceModel(device, deviceModel);
    private static stringObjToPrimitiveConverter(obj);
}
