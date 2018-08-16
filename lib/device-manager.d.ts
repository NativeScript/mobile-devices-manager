import { IUnitOfWork } from "../db/interfaces/unit-of-work";
import { IDevice } from "mobile-devices-controller";
export declare class DeviceManager {
    private _unitOfWork;
    private _useLocalRepository;
    private _usedDevices;
    constructor(_unitOfWork: IUnitOfWork, _useLocalRepository?: boolean);
    boot(query: any, count: any, shouldUpdate?: boolean): Promise<IDevice[]>;
    subscribeForDevice(query: any): Promise<IDevice>;
    unsubscribeFromDevice(query: any): Promise<IDevice>;
    killDevices(query?: any): Promise<{}>;
    refreshData(query: any, updateQuery: any): Promise<{}>;
    dropdb(): Promise<{}>;
    update(token: any, udpateQuery: any): Promise<IDevice>;
    checkDeviceStatus(maxUsageTime: any): void;
    private getMaxDeviceCount;
    private killOverUsedBusyDevices;
    private resetDevicesCountToMaxLimitedCount;
    private killDevice;
    private mark;
    private unmark;
    private createModel;
    private static deviceToJSON;
    private static convertIDeviceToQuery;
    private increaseDevicesUsage;
    private resetUsage;
    private checkDeviceUsageHasReachedLimit;
}
