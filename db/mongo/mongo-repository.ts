import { Model, Document, DocumentQuery } from "mongoose"; //import mongoose
import { IRepository } from "../interfaces/repository";

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

    public async get(query): Promise<Array<T>> {
        const result = await this._entitySet.find(query);
        if (!result) {
            return new Array<T>();
        }

        return result;
    }

    public async find(query?): Promise<Array<T>> {
        const result = await this._entitySet.find(query);
        const array = new Array<T>();

        result.forEach(element => {
            array.push(<T>element);
        });

        return array;
    }

    public async findSingle(query): Promise<T> {
        const result = await this._entitySet.findOne(query);
        if (!result) {
            return null;
        }

        return result;
    }

    public async update(token: string, values) {
        const device = await this._entitySet.findOne({ "token": token });
        return await this._entitySet.update(device, values);
    }

    public async remove(item) {
        return await this._entitySet.remove(item);
    }

    public async dropDb() {
        await this._entitySet.db.dropDatabase();
    }
}
