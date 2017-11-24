import { Model, Document, DocumentQuery } from "mongoose"; //import mongoose
import { IDevice } from "mobile-devices-controller";
import { IRepository } from "../interfaces/repository";
import { IDeviceModel } from "../interfaces/device-model";

export class MongoRepository<T extends Document> implements IRepository<T> {
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

    public async find(query: T): Promise<Array<T>> {
        const result = await this._entitySet.find(query);
        const array = new Array<T>();

        result.forEach(element => {
            array.push(<T>element);
        });

        return array;
    }

    public async findByToken(token): Promise<T> {
        const result = await this._entitySet.findOne({ token: token });
        if (!result) {
            return null;
        }

        return result;
    }

    public async findSingle(query): Promise<T> {
        const result = await this._entitySet.findOne(query);
        if (!result) {
            return null;
        }

        return result;
    }

    public async update(token: string, values: T) {
        const device = await this._entitySet.findOne({ "token": token });
        return await this._entitySet.update(device, values);
    }

    public async remove(item) {
        return await this._entitySet.remove(item);
    }

    public async dropDb() {
        await this._entitySet.db.dropDatabase();
    }

    private static copyIDeviceModelToDevice(deviceModel: IDeviceModel, device?: IDevice): IDevice {
        if (!device) {
            device = {
                name: MongoRepository.stringObjToPrimitiveConverter(deviceModel['name']),
                apiLevel: MongoRepository.stringObjToPrimitiveConverter(deviceModel["apiLevel"]),
                type: MongoRepository.stringObjToPrimitiveConverter(deviceModel["type"]),
                platform: MongoRepository.stringObjToPrimitiveConverter(deviceModel["platform"]),
                token: MongoRepository.stringObjToPrimitiveConverter(deviceModel["token"]),
                status: MongoRepository.stringObjToPrimitiveConverter(deviceModel["status"]),
                pid: deviceModel["pid"],
                info: deviceModel["info"],
                config: deviceModel["config"],
                busySince: deviceModel["busySince"],
                startedAt: deviceModel["startedAt"],
            }
        } else {
            device.name = MongoRepository.stringObjToPrimitiveConverter(deviceModel["name"]);
            device.pid = deviceModel["pid"];
            device.startedAt = deviceModel["startedAt"];
            device.status = MongoRepository.stringObjToPrimitiveConverter(deviceModel["status"]);
            device.token = MongoRepository.stringObjToPrimitiveConverter(deviceModel["token"]);
            device.type = MongoRepository.stringObjToPrimitiveConverter(deviceModel["type"]);
            device.platform = MongoRepository.stringObjToPrimitiveConverter(deviceModel["platform"]);
            device.apiLevel = MongoRepository.stringObjToPrimitiveConverter(deviceModel["apiLevel"]);
            device.info = MongoRepository.stringObjToPrimitiveConverter(deviceModel["info"]);
            device.config = MongoRepository.stringObjToPrimitiveConverter(deviceModel["config"]);
        }

        return device;
    }

    private static copyDeviceToIDeviceModel(device: IDevice, deviceModel: IDeviceModel) {
        deviceModel["name"] = device.name;
        deviceModel["pid"] = device.pid;
        deviceModel["startedAt"] = device.startedAt;
        deviceModel["status"] = device.status;
        deviceModel["token"] = device.token;
        deviceModel["type "] = device.type;
        deviceModel["info "] = device.info;
        deviceModel["config"] = device.config;
        deviceModel["apiLevel"] = device.apiLevel;
    }

    private static stringObjToPrimitiveConverter(obj: String) {
        let value: any = undefined;
        if (obj) {
            value = obj + "";
        }
        return value;
    }
}

