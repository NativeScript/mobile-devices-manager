import { IUnitOfWork } from "../db/interfaces/unit-of-work";
import { IDevice } from "mobile-devices-controller";
export declare class DeviceManager {
    private _unitOfWork;
    private _useLocalRepository;
    private readonly maxDeviceUsage;
    private readonly maxDeviceRebootCycles;
    private _usedDevices;
    constructor(_unitOfWork: IUnitOfWork, _useLocalRepository?: boolean);
    boot(query: any, count: any, shouldUpdate?: boolean): Promise<IDevice[]>;
    subscribeForDevice(query: any): Promise<IDevice>;
    unsubscribeFromDevice(query: any, maxDeviceUsage: any): Promise<IDevice>;
    private refreshDeviceStatus(device);
    private unmark(query);
    private killDevicesOverLimit(query);
    killDevices(query?: any): Promise<{}>;
    refreshData(query: any, updateQuery: any): Promise<{}>;
    dropdb(): Promise<{}>;
    update(token: any, udpateQuery: any): Promise<IDevice>;
    private killDevice(device);
    private mark(query);
    private createModel(device);
    private static deviceToJSON(device);
    private static convertIDeviceToQuery(from);
    private increaseDevicesUsage(device);
    private resetUsage(device);
    private checkDeviceUsageHasReachedLimit(count, device);
    private isAndroid(device);
    private isIOS(device);
}
