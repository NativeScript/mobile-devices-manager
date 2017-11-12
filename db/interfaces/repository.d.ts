export interface IRepository<T> {
    find(query?: T): Promise<Array<T>>;
    findSingle(query: T): Promise<T>;
    findByToken(token: string): Promise<T>;
    update(token: string, query: T): any;
    add(query: T): any;
    remove(query: any): any;
    dropDb(): Promise<void>;
}
