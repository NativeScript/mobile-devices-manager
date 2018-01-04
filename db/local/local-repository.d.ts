import { IRepository } from '../interfaces/repository';
import { IDevice } from 'mobile-devices-controller';
export declare class LocalRepository<T extends IDevice> implements IRepository<T> {
    constructor();
    find(query: any): Promise<Array<T>>;
    findByToken(token: any): Promise<T>;
    findSingle(item: any): Promise<T>;
    private filter(query);
    update(token: string, obj: T): Promise<any>;
    add(item: T): Promise<void>;
    remove(item: any): Promise<void>;
    dropDb(): any;
    private setDiveceStatus(device);
    private static getInfo(device);
    private static setInfo(device);
    private static writeToStorage(device);
    private static copyProperties(from);
    private static convertIDeviceToQuery(from);
    private static getStorageDir(token);
    private createStorage(token);
}
