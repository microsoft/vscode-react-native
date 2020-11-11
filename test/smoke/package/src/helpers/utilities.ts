// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.

import * as path from "path";
import * as fs from "fs";
import * as cp from "child_process";
import * as request from "request";
import * as URL from "url-parse";
import { dirname } from "path";
import { SpawnSyncOptions } from "child_process";
import { SmokeTestsConstants } from "./smokeTestsConstants";
import { Platform } from "./appiumHelper";
import { IosSimulatorHelper } from "./iosSimulatorHelper";
import { AndroidEmulatorHelper } from "./androidEmulatorHelper";
import { SmokeTestLogger } from "./smokeTestLogger";

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

export function spawnSync(command: string, args?: string[], options?: SpawnSyncOptions) {
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

export function getContents(url, token, headers, callback) {
    request.get(toRequestOptions(url, token, headers), function (error, response, body) {
        if (!error && response && response.statusCode >= 400) {
            error = new Error("Request returned status code: " + response.statusCode + "\nDetails: " + response.body);
        }

        callback(error, body);
    });
}

export function toRequestOptions(url, token?, headers?) {
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
export async function sleep(time: number) {
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

export function filterProgressBarChars(str: string) {
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

export interface ExpoLaunch {
    successful: boolean;
    failed: boolean;
}

export function waitUntilLaunchScenarioTargetUpdate(workspaceRoot: string, platform: Platform): Promise<boolean> {
    return new Promise((resolve) => {
        const LAUNCH_UPDATE_TIMEOUT = 30;
        const rejectTimeout = setTimeout(() => {
            cleanup();
            resolve(false);
        }, LAUNCH_UPDATE_TIMEOUT * 1000);

        const bootCheckInterval = setInterval(async () => {
            let isUpdated: boolean = false;
            switch (platform) {
                case Platform.Android:
                    isUpdated = isLaunchScenarioContainsTarget(workspaceRoot, AndroidEmulatorHelper.getDevice());
                    break;
                case Platform.iOS:
                    isUpdated = isLaunchScenarioContainsTarget(workspaceRoot, IosSimulatorHelper.getDeviceUdid());
                    break;
            }
            if (isUpdated) {
                cleanup();
                resolve(true);
            }
        }, 1000);

        const cleanup = () => {
            clearTimeout(rejectTimeout);
            clearInterval(bootCheckInterval);
        };
    });
}

export function isLaunchScenarioContainsTarget(workspaceRoot: string, targetValue?: string): boolean {
    const pathToLaunchFile = path.resolve(workspaceRoot, ".vscode", "launch.json");
    return findStringInFile(pathToLaunchFile, `"target": "${targetValue}"`);
}

export async function waitForRunningPackager(filePath: string) {
    let awaitRetries: number = 5;
    let retry = 1;
    return new Promise<void>((resolve, reject) => {
        let check = setInterval(async () => {
            let packagerStarted = findStringInFile(filePath, SmokeTestsConstants.PackagerStartedPattern);
            SmokeTestLogger.info(`Searching for Packager started logging pattern for ${retry} time...`);
            if (packagerStarted) {
                clearInterval(check);
                SmokeTestLogger.success(`Packager started pattern is found`);
                resolve();
            } else {
                retry++;
                if (retry >= awaitRetries) {
                    SmokeTestLogger.info(`Packager started logging pattern is not found after ${retry} retries`);
                    clearInterval(check);
                    reject(`Packager started logging pattern is not found after ${retry} retries`);
                }
            }
        }, 5000);
    });
}

export async function findExpoSuccessAndFailurePatterns(filePath: string, successPattern: string, failurePattern: string): Promise<ExpoLaunch> {
    let awaitRetries: number = SmokeTestsConstants.expoAppLaunchTimeout / 5000;
    let retry = 1;
    return new Promise<ExpoLaunch>((resolve) => {
        let check = setInterval(async () => {
            let expoStarted = findStringInFile(filePath, successPattern);
            let expoFailed = findStringInFile(filePath, failurePattern);
            SmokeTestLogger.info(`Searching for Expo launch logging patterns for ${retry} time...`);
            if (expoStarted || expoFailed) {
                clearInterval(check);
                const status: ExpoLaunch = { successful: expoStarted, failed: expoFailed };
                SmokeTestLogger.info(`Expo launch status patterns found: ${JSON.stringify(status, null, 2)}`);
                resolve(status);
            } else {
                retry++;
                if (retry >= awaitRetries) {
                    SmokeTestLogger.warn(`Expo launch logging patterns are not found after ${retry} retries:`);
                    clearInterval(check);
                    resolve({ successful: expoStarted, failed: expoFailed });
                }
            }
        }, 5000);
    });
}

export async function checkIfAppIsInstalledOnWindows(appName: string, timeout: number): Promise<boolean> {
    let awaitRetries: number = timeout / 5000;
    let retry = 1;
    return new Promise<boolean>((resolve) => {
        let check = setInterval(async () => {
            console.log(`Searching for app ${appName} patterns for ${retry} time...`);
            if (cp.execSync("tasklist").toString().indexOf(appName) > 0) {
                clearInterval(check);
                console.log(`Found launched ${appName}`);
                resolve(true);
            } else {
                retry++;
                if (retry >= awaitRetries) {
                    console.log(`App ${appName} not found after ${retry} retries:`);
                    clearInterval(check);
                    resolve(false);
                }
            }
        }, 5000);
    });
}

export function findExpoURLInLogFile(filePath: string) {
    let content = fs.readFileSync(filePath).toString().trim();
    const match = content.match(/exp:\/\/\d+\.\d+\.\d+\.\d+\:\d+/gm);
    if (!match) return null;
    let expoURL = match[0];
    SmokeTestLogger.success(`Found Expo URL: ${expoURL}`);
    return expoURL;
}

export function getIOSBuildPath(
    iosProjectRoot: string,
    projectWorkspaceConfigName: string,
    configuration: string,
    scheme: string,
    sdkType: string
): string {
    const buildSettings = cp.execFileSync(
        "xcodebuild",
        [
            "-workspace",
            projectWorkspaceConfigName,
            "-scheme",
            scheme,
            "-sdk",
            sdkType,
            "-configuration",
            configuration,
            "-showBuildSettings",
        ],
        {
            encoding: "utf8",
            cwd: iosProjectRoot,
        }
    );

    const targetBuildDir = getTargetBuildDir(<string>buildSettings);

    if (!targetBuildDir) {
        throw new Error("Failed to get the target build directory.");
    }
    return targetBuildDir;
}

/**
 *
 * The function was taken from https://github.com/react-native-community/cli/blob/master/packages/platform-ios/src/commands/runIOS/index.ts#L369-L374
 *
 * @param {string} buildSettings
 * @returns {string | null}
 */
function getTargetBuildDir(buildSettings: string) {
    const targetBuildMatch = /TARGET_BUILD_DIR = (.+)$/m.exec(buildSettings);
    return targetBuildMatch && targetBuildMatch[1]
        ? targetBuildMatch[1].trim()
        : null;
}
