export interface IRepository<T> {
    find(query?: T): Promise<Array<T>>;
    findSingle(query: T): Promise<T>;
    findByToken(token: string): Promise<T>;
    update(token: string, query: T): Promise<T>;
    add(query: T);
    addMany(query: T[]);
    deleteMany(query: any);
    remove(query);
    dropDb(): Promise<void>;
}