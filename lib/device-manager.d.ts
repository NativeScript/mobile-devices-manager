import { IUnitOfWork } from "../db/interfaces/unit-of-work";
import { IDevice } from "mobile-devices-controller";
export declare class DeviceManager {
    private _unitOfWork;
    private _useLocalRepository;
    constructor(_unitOfWork: IUnitOfWork, _useLocalRepository?: boolean);
    boot(query: any, count: any, shouldUpdate?: boolean): Promise<any[]>;
    subscribeDevice(query: any): Promise<IDevice>;
    unSubscribeDevice(query: any): Promise<IDevice>;
    update(searchQuery: any, udpateQuery: any): Promise<any[]>;
    killDevices(query?: any): Promise<any[]>;
    refreshData(query: any, updateQuery: any): Promise<any[]>;
    checkDeviceStatus(maxUsageTime: any): void;
    private mark(query);
    private unmark(query);
    private createModel(device);
    static copyProperties(from: IDevice, to?: IDevice): any;
}
