import { IRepository } from '../interfaces/repository';
export declare class LocalRepository<T> implements IRepository<T> {
    constructor();
    find(query: any): Promise<Array<T>>;
    findByToken(token: any): Promise<T>;
    findSingle(item: any): Promise<T>;
    private filter(query);
    update(token: string, obj: any): Promise<void>;
    add(item: T): Promise<void>;
    remove(item: any): Promise<void>;
    dropDb(): any;
    private setDiveceStatus(device);
    private static getInfo(device);
    private static setInfo(device);
    private static writeToStorage(device);
    private static copyProperties(from);
    private static getStorageDir(token);
    private createStorage(token);
}
