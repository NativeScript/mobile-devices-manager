import { Document } from "mongoose";
import { IDevice } from "./device";
export interface IDeviceModel extends IDevice, Document {
}
