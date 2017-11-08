import { IUnitOfWork } from "../db/interfaces/unit-of-work";
import { IDevice } from "mobile-devices-controller";
export declare class DeviceManager {
    private _unitOfWork;
    private _useLocalRepository;
    constructor(_unitOfWork: IUnitOfWork, _useLocalRepository?: boolean);
    boot(query: any, count: any): Promise<IDevice[]>;
    subscribeDevice(query: any): Promise<IDevice>;
    unSubscribeDevice(query: any): Promise<IDevice>;
    update(searchQuery: any, udpateQuery: any): Promise<any[]>;
    killDevices(query?: any): Promise<void>;
    refreshData(query?: any): Promise<IDevice[]>;
    checkDeviceStatus(maxUsageTime: any): void;
    private refreshDb(query);
    private createModel(device);
    private static copyProperties(from, to?);
}
