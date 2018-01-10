import { Model, Document, DocumentQuery } from "mongoose"; //import mongoose
import { IDevice } from "mobile-devices-controller";
import { IRepository } from "../interfaces/repository";
import { IModel } from "../interfaces/model";
import { IDeviceModel } from "../interfaces/device-model";

export class MongoRepository<T extends IDeviceModel> implements IRepository<T> {
    private _entitySet: Model<T>

    constructor(entities: Model<T>) {
        if (!entities) {
            throw new Error("No entities provided.");
        }

        this._entitySet = entities;
    }

    public async add(item: T) {
        return await this._entitySet.create(item);
    }

    public async addMany(items: T[]) {
        return await this._entitySet.create(...items);
    }

    public async deleteMany(item: any) {
        return await this._entitySet.deleteMany(item);
    }

    public async find(query: T): Promise<Array<T>> {
        const result = await this._entitySet.find(query);
        const array = new Array<T>();

        result.forEach(element => {
            array.push(<T>element);
        });

        return array;
    }

    public async findByToken(token: string): Promise<T> {
        const result = await this._entitySet.findOne({ "token": token });
        if (!result) {
            return null;
        }

        return result;
    }

    public async findSingle(query: T): Promise<T> {
        const result = await this._entitySet.findOne(query);

        return result;
    }

    public async update(token: string, values: T) {
        const device: IDeviceModel = await this._entitySet.findOne({ "token": token });
        const result = await this._entitySet.update({ "token": token }, this.copyDeviceToIDeviceModel(values, device));
        return result;
    }

    public async remove(item: T) {
        return await this._entitySet.remove(item);
    }

    public async dropDb() {
        await this._entitySet.db.dropDatabase();
    }

    private copyDeviceToIDeviceModel(device: T, deviceModel: IDeviceModel) {
        if (!device) {
            return deviceModel;
        }

        deviceModel['_doc']['name'] = device['name'];
        deviceModel['_doc']['pid'] = device['pid'];
        deviceModel['_doc']['startedAt'] = device['startedAt'];
        deviceModel['_doc']['busySince'] = device['busySince'];
        deviceModel['_doc']['status'] = device['status'];
        deviceModel['_doc']['token'] = device['token'];
        deviceModel['_doc']['type'] = device['type'];
        deviceModel['_doc']['info'] = device['info'] || "";
        deviceModel['_doc']['config'] = device['config'] || "";
        deviceModel['_doc']['apiLevel'] = device['apiLevel'];
        return deviceModel;
    }

    // private static copyIDeviceModelToDevice(deviceModel: IDeviceModel, device?: IDevice): IDevice {
    //     if (!device) {
    //         device = {
    //             name: MongoRepository.stringObjToPrimitiveConverter(deviceModel['name']),
    //             apiLevel: MongoRepository.stringObjToPrimitiveConverter(deviceModel["apiLevel"]),
    //             type: MongoRepository.stringObjToPrimitiveConverter(deviceModel["type"]),
    //             platform: MongoRepository.stringObjToPrimitiveConverter(deviceModel["platform"]),
    //             token: MongoRepository.stringObjToPrimitiveConverter(deviceModel["token"]),
    //             status: MongoRepository.stringObjToPrimitiveConverter(deviceModel["status"]),
    //             pid: deviceModel["pid"],
    //             info: deviceModel["info"],
    //             config: deviceModel["config"],
    //             busySince: deviceModel["busySince"],
    //             startedAt: deviceModel["startedAt"],
    //         }
    //     } else {
    //         device.name = MongoRepository.stringObjToPrimitiveConverter(deviceModel["name"]);
    //         device.pid = deviceModel["pid"];
    //         device.startedAt = deviceModel["startedAt"];
    //         device.status = MongoRepository.stringObjToPrimitiveConverter(deviceModel["status"]);
    //         device.token = MongoRepository.stringObjToPrimitiveConverter(deviceModel["token"]);
    //         device.type = MongoRepository.stringObjToPrimitiveConverter(deviceModel["type"]);
    //         device.platform = MongoRepository.stringObjToPrimitiveConverter(deviceModel["platform"]);
    //         device.apiLevel = MongoRepository.stringObjToPrimitiveConverter(deviceModel["apiLevel"]);
    //         device.info = MongoRepository.stringObjToPrimitiveConverter(deviceModel["info"]);
    //         device.config = MongoRepository.stringObjToPrimitiveConverter(deviceModel["config"]);
    //     }

    //     return device;
    // }

    // private copyDeviceToIDeviceModel(device: IDevice, deviceModel: IDeviceModel) {
    //     let dev = this._entitySet.create()
    //     deviceModel["name"] = device.name;
    //     deviceModel["pid"] = device.pid;
    //     deviceModel["startedAt"] = device.startedAt;
    //     deviceModel["status"] = device.status;
    //     deviceModel["token"] = device.token;
    //     deviceModel["type "] = device.type;
    //     deviceModel["info "] = device.info;
    //     deviceModel["config"] = device.config;
    //     deviceModel["apiLevel"] = device.apiLevel;
    //     return deviceModel;
    // }

    // private static stringObjToPrimitiveConverter(obj: String) {
    //     let value: any = undefined;
    //     if (obj) {
    //         value = obj + "";
    //     }
    //     return value;
    // }
}
