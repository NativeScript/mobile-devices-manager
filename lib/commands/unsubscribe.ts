import * as yargs from 'yargs';
import * as fs from "fs";
import * as constantns from "../parser";
import { executeCommand, getDeviceManager } from "../utils";
import { DeviceManager } from "../device-manager";
import { IDevice } from "mobile-devices-controller";

export function command() {
    return "unsubscribe";
}

export function describe() {
    return "Unsubscribe from device";
}

export function builder() {
    yargs
        .usage("Usage: {token:udid }")
        .option("token", { describe: "Device name", type: "string" })
        .help()
    return yargs;
}

export async function handler(yargs) {
    const device = await unsubscribe(yargs.token);
    console.log(device['token'] || device['_token']);
}

export async function unsubscribe(token) {
    const manager = await getDeviceManager(constantns);
    return await manager.unsubscribeFromDevice({ token: token });
}
