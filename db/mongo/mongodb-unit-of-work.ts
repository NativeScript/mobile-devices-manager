import { Connection, createConnection } from "mongoose";
import { IUnitOfWork } from "../interfaces/unit-of-work";
import { IRepository } from "../interfaces/repository";
import { IDeviceModel } from "../interfaces/device-model";
import { MongoRepository } from "./mongo-repository";
import * as schema from "./schemas/schema";
import { IDevice } from "mobile-devices-controller";
require('mongoose').Promise = require("q").Promise;

const MONGODB_CONNECTION: string = "mongodb://127.0.0.1:27017/devices";

export class MongoUnitOfWork implements IUnitOfWork {
    private _devices: IRepository<IDeviceModel>;
    private _context: Connection;

    constructor() {
    }

    public static async createConnection(connectionString: string = MONGODB_CONNECTION) {
        const mongoUnitOfWork: MongoUnitOfWork = new MongoUnitOfWork();
        mongoUnitOfWork._context = await createConnection(connectionString, {
            server: {
                reconnectTries: Number.MAX_VALUE,
                autoReconnect: true
            }
        });

        return mongoUnitOfWork;
    }

    get devices(): IRepository<IDeviceModel> {
        if (!this._devices) {
            this._devices = new MongoRepository<IDeviceModel>(this._context.model<IDeviceModel>("Device", schema.device));
        }
        return this._devices;
    }
}