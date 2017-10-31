import { IRepository } from "../interfaces/repository";

export class LocalRepository<T> implements IRepository<T> {

    constructor() {
    }

    public async add(item: T) {
    }

    public async get(query): Promise<Array<T>> {
        const result = null;
        if (!result) {
            return new Array<T>();
        }

        return result;
    }

    public async update(item: string, values) {
    }

    public async remove(item) {
    }

    public async find(item): Promise<Array<T>> {
        return new Promise<Array<T>>(() => {

        });
    }

    public async findSingle(item): Promise<T> {
        return new Promise<T>(() => {

        });
    }

    public dropDb() {
        return null;
    }
}
