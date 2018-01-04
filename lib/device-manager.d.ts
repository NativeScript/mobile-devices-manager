import { IUnitOfWork } from "../db/interfaces/unit-of-work";
import { IDevice } from "mobile-devices-controller";
export declare class DeviceManager {
    private _unitOfWork;
    private _useLocalRepository;
    constructor(_unitOfWork: IUnitOfWork, _useLocalRepository?: boolean);
    boot(query: any, count: any, shouldUpdate?: boolean): Promise<IDevice[]>;
    subscribeForDevice(query: any): Promise<IDevice>;
    unsubscribeFromDevice(query: any): Promise<IDevice>;
    killDevices(query?: any): Promise<IDevice[]>;
    refreshData(query: any, updateQuery: any): Promise<IDevice[]>;
    dropdb(): Promise<IDevice[]>;
    update(token: any, udpateQuery: any): Promise<IDevice>;
    checkDeviceStatus(maxUsageTime: any): void;
    private mark(query);
    private unmark(query);
    private createModel(device);
    private static convertIDeviceToQuery(from);
}
