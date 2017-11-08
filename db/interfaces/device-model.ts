import { Document } from "mongoose";
import { IDevice } from "mobile-devices-controller";

export interface IDeviceModel extends IDevice, Document {
  //custom methods for your model would be defined here
}