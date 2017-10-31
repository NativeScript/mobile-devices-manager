import * as yargs from "yargs";
import { join, dirname } from "path";
import { resolve } from "./utils";

const config = (() => {
    const options = yargs
        .option("verbose", { alias: "v", describe: "Log actions", type: "boolean" })
        .option("localStorage", { describe: "path", default: process.cwd(), type: "string" })
        .option("mongoDb", { describe: "path", default: process.cwd(), type: "string" })
        .help()
        .argv;

    const config = {
        verbose: options.verbose,
        localStorage: options.localStorage,
        mongoDb: options.mongoDb
    };

    return config;
})();

export const {
    localStorage,
    mongoDb,
    verbose
} = config;