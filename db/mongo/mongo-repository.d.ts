import { Model, Document } from "mongoose";
import { IRepository } from "../interfaces/repository";
export declare class MongoRepository<T extends Document> implements IRepository<T> {
    private _entitySet;
    constructor(entities: Model<T>);
    add(item: T): Promise<T>;
    get(query: any): Promise<Array<T>>;
    find(query?: any): Promise<Array<T>>;
    findSingle(query: any): Promise<T>;
    update(token: string, values: any): Promise<any>;
    remove(item: any): Promise<void>;
    dropDb(): Promise<void>;
}
