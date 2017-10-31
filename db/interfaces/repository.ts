export interface IRepository<T> {
    add(item: T);
    get(query): Promise<Array<T>>
    remove(query);
    update(item: string, query);
    find(query?): Promise<Array<T>>;
    findSingle(query): Promise<T>;
    dropDb(): Promise<void>;
}