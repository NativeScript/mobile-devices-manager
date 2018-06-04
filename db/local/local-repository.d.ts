import { IRepository } from '../interfaces/repository';
import { IDevice } from 'mobile-devices-controller';
export declare class LocalRepository<T extends IDevice> implements IRepository<T> {
    constructor();
    find(query: any): Promise<Array<T>>;
    findByToken(token: any): Promise<T>;
    findSingle(item: any): Promise<T>;
    private filter;
    update(token: string, obj: T): Promise<any>;
    add(item: T): Promise<any>;
    addMany(item: T[]): Promise<any>;
    deleteMany(item: any): Promise<any>;
    remove(item: any): Promise<void>;
    dropDb(): any;
    private setDiveceStatus;
    private static getInfo;
    private static setInfo;
    private static writeToStorage;
    private static copyProperties;
    private static convertIDeviceToQuery;
    private static getStorageDir;
    private createStorage;
}
