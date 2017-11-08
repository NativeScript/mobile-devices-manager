import { spawnSync } from "child_process";
import * as path from "path";

import {
    existsSync,
    statSync,
    writeFileSync,
    readFileSync,
    mkdirSync,
    rmdirSync,
    unlinkSync,
    readdirSync
} from "fs";

export function executeCommand(args, cwd?): string {
    cwd = cwd || process.cwd();

    const output = spawnSync("", args.split(" "), {
        shell: true,
        cwd: process.cwd(),
        encoding: "UTF8"
    });

    return output.output[1].toString();
}

export function waitForOutput(process, matcher, errorMatcher, timeout) {
    return new Promise<boolean>(function (r, reject) {
        const abortWatch = setTimeout(function () {
            process.kill();
            console.log("Timeout expired, output not detected for: " + matcher);
            r(false);
        }, timeout);

        process.stdout.on("data", function (data) {
            let line = "" + data;
            console.log(line);
            if (errorMatcher.test(line)) {
                clearTimeout(abortWatch);
                r(false);
            }

            if (matcher.test(line)) {
                clearTimeout(abortWatch);
                r(true);
            }
        });
    });
}

export function resolve(mainPath, ...args) {
    if (!path.isAbsolute(mainPath)) {
        if (mainPath.startsWith('~')) {
            mainPath = path.join(process.env.HOME, mainPath.slice(1));
        } else {
            mainPath = resolve(mainPath);
        }
    }

    let fullPath = mainPath;
    args.forEach(p => {
        fullPath = resolve(fullPath, p);
    });
    return fullPath;
}


export function fileExists(p) {
    try {
        if (existsSync(p)) {
            return true;
        }

        return false;
    } catch (e) {
        if (e.code == 'ENOENT') {
            console.log("File does not exist. " + p, true);
            return false;
        }

        console.log("Exception fs.statSync (" + path + "): " + e, true);
        return false;
    }
}

export function resolveFiles(mainPath, ...args) {
    if (!path.isAbsolute(mainPath)) {
        if (mainPath.startsWith('~')) {
            mainPath = path.join(process.env.HOME, mainPath.slice(1));
        } else {
            mainPath = path.resolve(mainPath);
        }
    }

    let fullPath = mainPath;
    args.forEach(p => {
        fullPath = path.resolve(fullPath, p);
    });
    return fullPath;
}

export function fileInfo(fileName) {
    const stat = statSync(fileName);
    return { mtime: stat.mtime };
}

export function removeFileOrFolder(fullName: string) {
    if (isDirectory(fullName)) {
        try {
            rmdirSync(fullName);
        } catch (error) {
            unlinkSync(fullName);
        }

    } else if (isFile(fullName) || isSymLink(fullName)) {
        unlinkSync(fullName);
    }
}

export function removeFilesRecursive(mainDir: string, files: Array<string> = new Array()) {
    if (!fileExists(mainDir)) {
        return;
    }
    const rootFiles = getAllFileNames(mainDir);
    var mainDirFullName = mainDir;
    rootFiles.forEach(f => {
        let fullName = resolve(mainDirFullName, f);
        if (isDirectory(fullName)) {
            removeFilesRecursive(fullName, files);
        } else {
            removeFileOrFolder(fullName);
            files.push(fullName);
        }
    });

    if (getAllFileNames(mainDir).length === 0) {
        removeFileOrFolder(mainDir);
    }

    return files;
}


export function isDirectory(fullName: string) {
    try {
        if (statSync(fullName).isDirectory()) {
            return true;
        }
    } catch (e) {
        console.log(e.message);
        return false;
    }

    return false;
}

export function isFile(fullName: string) {
    try {
        if (statSync(fullName).isFile()) {
            return true;
        }
    } catch (e) {
        console.log(e.message);
        return false;
    }

    return false;
}

export function isSymLink(fullName: string) {
    try {
        if (statSync(fullName).isSymbolicLink()) {
            return true;
        }
    } catch (e) {
        return false;
    }

    return false;
}

export function getAllFileNames(folder: string) {
    let files: Array<string> = new Array();
    readdirSync(resolve(folder)).forEach(file => {
        files.push(file);
    });

    return files;
}

export function mkDir(dir) {
    let mainPath: string = null;
    dir.split(path.sep).forEach(element => {
        if (mainPath === null) {
            mainPath = element;
        } else {
            mainPath += path.sep + element;
        }
        if (!fileExists(mainPath)) {
            mkdirSync(mainPath);
        }
    });
}

export function mkFile(file: string, content: any) {
    const dir = path.dirname(file);
    mkDir(dir);
    writeFileSync(file, content);
}

export function writeFileToJson(file, content: any) {
    const json = JSON.stringify(content, null, 2);
    mkFile(file, json);
}

export function readJsonFromFile(file) {
    const jsonFileContent = readFileSync(file, "UTF8");
    const json = JSON.parse(jsonFileContent);

    return json;
}