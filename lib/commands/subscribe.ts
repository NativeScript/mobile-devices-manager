import * as yargs from 'yargs';
import * as fs from "fs";
import { executeCommand, getDeviceManager } from "../utils";
import * as constantns from "../parser";
import { DeviceManager } from "../device-manager";
import { IDevice } from "mobile-devices-controller";

export function command() {
    return "subscribe";
}

export function describe() {
    return "Subscribe for device";
}

export function builder() {
    yargs
        .usage("Usage: {name:deviceName , platform: android/ios, apiLevel: 7.0/11.0, info:{appName: app}, }")
        .option("name", { describe: "Device name", type: "string" })
        .option("platform", { describe: "ios/ android", type: "string" })
        .option("apiLevel", { describe: "Api level", type: "string" })
        .option("info", { describe: "Info", type: "string" })
        .help()
    return yargs;
}

export async function handler(yargs) {
    const device = await subscribe(yargs);
    console.log(device['token'] || device['_token']);
}

export async function subscribe(yargs) {
    const manager = getDeviceManager(constantns);
    return await manager.subscribeDevice({ name: yargs.name, platform: yargs.platform, apiLevel: yargs.apiLevel, info: yargs.info });
}
