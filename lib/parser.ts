import * as yargs from "yargs";
import { join, dirname } from "path";
import { resolve } from "./utils";

const config = (() => {
    const options = yargs
        .command("subscribe", "subscribe for device", require("./commands/subscribe"))
        .command("unsubscribe", "unsubscribe for device", require("./commands/unsubscribe"))
        .option("verbose", { alias: "v", defualt: false, describe: "Log actions", type: "boolean" })
        .option("useMongoDB", { describe: "Should use mongodb to store data. Please make sure that you have already started mongo server!", default: false, type: "boolean" })
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