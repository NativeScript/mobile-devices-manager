import { Document } from "mongoose";
import { IDevice } from "mobile-devices-controller";
export interface IDeviceModel extends IDevice, Document {
}
