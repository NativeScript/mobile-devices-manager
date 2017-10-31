export interface IDevice {
    name: string;
    token: string;
    type: string;
    platform: string;
    status?: string;
    info?: string;
    config?: any;
    apiLevel?: string;
    startedAt?: number;
    busySince?: number;
    pid?: number;
}
