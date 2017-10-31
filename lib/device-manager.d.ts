import * as d from "../models/interfaces/device";
import { IUnitOfWork } from "../db/interfaces/unit-of-work";
export declare class DeviceManager {
    private _unitOfWork;
    constructor(_unitOfWork: IUnitOfWork);
    bootDevices(): Promise<void>;
    boot(query: any, count: any): Promise<d.IDevice[]>;
    subscribeDevice(platform: any, deviceType: any, app: any, apiLevel: any, deviceName: any, count: any): Promise<any>;
    update(searchQuery: any, udpateQuery: any): Promise<any[]>;
    getIOSDevices(): any;
    getAndroidDevices(): any;
    killDevice(obj: any, _unitOfWork: IUnitOfWork): Promise<void>;
    killDeviceSingle(device: d.IDevice): Promise<void>;
    killAll(type?: string): Promise<void>;
    refreshData(request?: any): Promise<d.IDevice[]>;
    checkDeviceStatus(maxUsageTime: any): void;
    private static copyIDeviceModelToDevice(deviceModel, device?);
    private static copyDeviceToIDeviceModel(device, deviceModel);
    private static stringObjToPrimitiveConverter(obj);
    private loadDBWithAndroidDevices();
    private loadDBWithIOSDevices();
    private createModel(device);
}
