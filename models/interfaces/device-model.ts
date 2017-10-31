import { Document } from "mongoose";
import { IDevice } from "./device";

export interface IDeviceModel extends IDevice, Document {
  //custom methods for your model would be defined here
}