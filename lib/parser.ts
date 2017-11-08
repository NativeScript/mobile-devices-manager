import * as yargs from "yargs";
import { join, dirname } from "path";
import { resolve } from "./utils";

const config = (() => {
    const options = yargs
        .option("verbose", { alias: "v", defualt: false, describe: "Log actions", type: "boolean" })
        .option("localStorage", { describe: "Should use files to store data and mark devices!", default: true, type: "boolean" })
        .option("mongoDb", { describe: "Should use mongodb to store data. Please make sure that you have already started mongo server!", default: false, type: "boolean" })
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