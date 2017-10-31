export interface IRepository<T> {
    add(item: T): any;
    get(query: any): Promise<Array<T>>;
    remove(query: any): any;
    update(item: string, query: any): any;
    find(query?: any): Promise<Array<T>>;
    findSingle(query: any): Promise<T>;
    dropDb(): Promise<void>;
}
