import { Connection, createConnection } from "mongoose";
import { IUnitOfWork } from "../interfaces/unit-of-work";
import { IRepository } from "../interfaces/repository";
import { IDeviceModel } from "../../models/interfaces/device-model";
import { IDevice } from "../../models/interfaces/device";
import { MongoRepository } from "./mongo-repository";
import * as schema from "./schemas/schema";

const MONGODB_CONNECTION: string = "mongodb://localhost:27017/devices";

export class MongoUnitOfWork implements IUnitOfWork {
    private _devices: IRepository<IDeviceModel>;
    private _context: Connection;

    constructor(connectionString: string = MONGODB_CONNECTION) {
        this._context = createConnection(connectionString);
        require('mongoose').Promise = require("q").Promise;
    }

    get devices(): IRepository<IDevice> {
        //await connection.dropDatabase();        
        
        if (!this._devices) {
            this._devices = new MongoRepository<IDeviceModel>(this._context.model<IDeviceModel>("Device", schema.device));
        }
        return this._devices;
    }
}