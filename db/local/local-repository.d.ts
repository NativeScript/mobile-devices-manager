import { IRepository } from "../interfaces/repository";
export declare class LocalRepository<T> implements IRepository<T> {
    constructor();
    add(item: T): Promise<void>;
    get(query: any): Promise<Array<T>>;
    update(item: string, values: any): Promise<void>;
    remove(item: any): Promise<void>;
    find(item: any): Promise<Array<T>>;
    findSingle(item: any): Promise<T>;
    dropDb(): any;
}
