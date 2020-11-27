// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.

import * as fs from "fs";
import * as cp from "child_process";
import * as request from "request";
import * as URL from "url-parse";
import { dirname } from "path";
import { SpawnSyncOptions } from "child_process";
import { SmokeTestsConstants } from "./smokeTestsConstants";
import AndroidEmulatorManager from "./androidEmulatorManager";
import { AppiumHelper } from "./appiumHelper";
import IosSimulatorManager from "./iosSimulatorManager";
import { SmokeTestLogger } from "./smokeTestLogger";

export const npxCommand = process.platform === "win32" ? "npx.cmd" : "npx";
export const npmCommand = process.platform === "win32" ? "npm.cmd" : "npm";

// eslint-disable-next-line
export function nfcall<R>(fn: Function, ...args): Promise<R> {
    return new Promise<R>((c, e) => fn(...args, (err, r) => err ? e(err) : c(r)));
}

export async function mkdirp(path: string, mode?: number): Promise<boolean> {
    const mkdir = async () => {
        try {
            await nfcall(fs.mkdir, path, mode);
        } catch (err) {
            if (err.code === "EEXIST") {
                const stat = await nfcall<fs.Stats>(fs.stat, path);

                if (stat.isDirectory()) {
                    return;
                }

                throw new Error(`'${path}' exists and is not a directory.`);
            }

            throw err;
        }
    };

    // is root?
    if (path === dirname(path)) {
        return true;
    }

    try {
        await mkdir();
    } catch (err) {
        if (err.code !== "ENOENT") {
            throw err;
        }

        await mkdirp(dirname(path), mode);
        await mkdir();
    }

    return true;
}

export function sanitize(name: string): string {
    return name.replace(/[&*:\/]/g, "");
}

export function spawnSync(command: string, args?: string[], options?: SpawnSyncOptions): void {
    const result = cp.spawnSync(command, args, options);
    if (result.stdout) {
        SmokeTestLogger.log(result.stdout.toString());
    }
    if (result.stderr) {
        SmokeTestLogger.error(result.stderr.toString());
    }
    if (result.error) {
        throw result.error;
    }
}

export function execSync(command: string, options?: cp.ExecSyncOptions | undefined, logFilePath?: string): string {
    options = Object.assign(options, { stdio: "pipe" });
    let output = "";
    try {
        output = cp.execSync(command, options).toString();
    } catch (err) {
        output += err.stdout && err.stdout.toString();
        output += err.stderr && err.stderr.toString();
        if (logFilePath) {
            SmokeTestLogger.saveLogsInFile(output, logFilePath);
        }
        throw err;
    }

    if (logFilePath) {
        SmokeTestLogger.saveLogsInFile(output, logFilePath);
    }

    return output;
}

/**
 * Runs array of promises in parallel. Returns array of resolved results.
 * If any promise was rejected then the whole chain will be rejected.
 * @param promises Array of promises to run
 */
export function runInParallel(promises: Promise<any>[]): Promise<any[]> {
    return new Promise<any[]>((resolve, reject) => {
        let total = promises.length;
        let count = 0;
        let results: any[] = [];
        const saveResult = (result: any) => {
            results.push(result);
            ++count;
            if (count === total) {
                resolve(results);
            }
        };
        promises.forEach((promise) => {
            promise.then((result) => {
                saveResult(result);
            }).catch((e) => {
                reject(e);
            });
        });
    });
}

export function getContents(url: string, token: string | null, headers: any, callback: (error: Error, versionsContent: string) => void): void {
    request.get(toRequestOptions(url, token, headers), function (error, response, body) {
        if (!error && response && response.statusCode >= 400) {
            error = new Error("Request returned status code: " + response.statusCode + "\nDetails: " + response.body);
        }

        callback(error, body);
    });
}

export function toRequestOptions(url: string, token: string | null, headers?: any): any {
    headers = headers || {
        "user-agent": "nodejs",
    };

    if (token) {
        headers["Authorization"] = "token " + token;
    }

    let parsedUrl = new URL(url);

    let options: any = {
        url: url,
        headers: headers,
    };

    // We need to test the absence of true here because there is an npm bug that will not set boolean
    // env variables if they are set to false.
    if (process.env.npm_config_strict_ssl !== "true") {
        options.strictSSL = false;
    }

    if (process.env.npm_config_proxy && parsedUrl.protocol === "http:") {
        options.proxy = process.env.npm_config_proxy;
    } else if (process.env.npm_config_https_proxy && parsedUrl.protocol === "https:") {
        options.proxy = process.env.npm_config_https_proxy;
    }

    return options;
}

// Await function
export async function sleep(time: number): Promise<void> {
    await new Promise(resolve => {
        const timer = setTimeout(() => {
            clearTimeout(timer);
            resolve();
        }, time);
    });
}

export function findFile(directoryToSearch: string, filePattern: RegExp): string | null {
    const dirFiles = fs.readdirSync(directoryToSearch);
    let extensionFile = dirFiles.find((elem) => {
        return filePattern.test(elem);
    });
    if (extensionFile) {
        return extensionFile;
    }
    return null;
}

export function filterProgressBarChars(str: string): string {
    const filterRegExp = /\||\/|\-|\\/;
    str = str.replace(filterRegExp, "");
    return str;
}

export function findStringInFile(filePath: string, strToFind: string): boolean {
    if (fs.existsSync(filePath)) {
        const content = fs.readFileSync(filePath).toString().trim();
        return content.includes(strToFind);
    }
    return false;
}

export function objectsContains(object: any, subObject: any): boolean {
    for (let i = 0; i < Object.keys(subObject).length ; i++) {
        const key = Object.keys(subObject)[i];
        if (typeof subObject[key] === "object" && subObject[key] !== null) {
            if (typeof object[key] === "object" && object[key] !== null) {
                if (!objectsContains(object[key], subObject[key])) {
                    return false;
                }
            } else {
                return false;
            }
        }
        else if (subObject[key] !== object[key]) {
            return false;
        }
    }
    return true;
}

export function waitUntil(condition: () => boolean, timeout: number = 30000, interval: number = 1000): Promise<boolean> {
    return new Promise((resolve) => {
        const rejectTimeout = setTimeout(() => {
            cleanup();
            resolve(false);
        }, timeout);

        const сheckInterval = setInterval(async () => {
            if (condition()) {
                cleanup();
                resolve(true);
            }
        }, interval);

        const cleanup = () => {
            clearTimeout(rejectTimeout);
            clearInterval(сheckInterval);
        };
    });
}

export async function waitForRunningPackager(filePath: string): Promise<boolean> {

    const condition = () => {
        return findStringInFile(filePath, SmokeTestsConstants.PackagerStartedPattern);
    };

    return waitUntil(condition)
        .then((result) => {
            if (result) {
                SmokeTestLogger.success(`Packager started pattern is found`);
            }
            else {
                SmokeTestLogger.warn(`Packager started logging pattern is not found`);
            }
            return result;
        });
}

export async function smokeTestFail(message: string): Promise<void> {
    SmokeTestLogger.error(message);
    await AndroidEmulatorManager.terminateAllAndroidEmulators();
    if (process.platform === "darwin") {
        try {
            await IosSimulatorManager.shutdownAllSimulators();
        } catch (e) {
            SmokeTestLogger.error(e.toString());
        }
    }
    await AppiumHelper.terminateAppium();
    process.exit(1);
}
