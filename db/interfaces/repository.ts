export interface IRepository<T> {
    find(query?: T): Promise<Array<T>>;
    findSingle(query: T): Promise<T>;
    update(token: string, query: T);
    add(query: T);
    remove(query);
    dropDb(): Promise<void>;
}