// --- Error normalization helpers ---
export function asError(error: unknown): Error {
    if (error instanceof Error) return error;
    return new Error(errorToString(error));
}

export function errorToString(error: unknown): string {
    if (typeof error === "string") return error;
    if (error instanceof Error) return error.stack || error.message;
    if (error && typeof error === "object") {
        try {
            return JSON.stringify(error);
        } catch {}
    }
    return String(error);
}
// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.

import * as fs from "fs";
import * as cp from "child_process";
import { quote } from "shell-quote";
import { dirname } from "path";
import { SpawnSyncOptions } from "child_process";
import { SmokeTestLogger } from "./smokeTestLogger";

export const npxCommand = process.platform === "win32" ? "npx.cmd" : "npx";
export const npmCommand = process.platform === "win32" ? "npm.cmd" : "npm";
export const yarnCommand = process.platform === "win32" ? "yarn.cmd" : "yarn";

// eslint-disable-next-line
export function nfcall<R>(fn: Function, ...args): Promise<R> {
    return new Promise<R>((c, e) => fn(...args, (err, r) => (err ? e(err) : c(r))));
}

export async function mkdirp(path: string, mode?: number): Promise<boolean> {
    const mkdir = async () => {
        try {
            await nfcall(fs.mkdir, path, mode);
        } catch (err: unknown) {
            if (typeof err === "object" && err && (err as any).code === "EEXIST") {
                const stat = await nfcall<fs.Stats>(fs.stat, path);
                if (stat.isDirectory()) {
                    return;
                }
                throw new Error(`'${path}' exists and is not a directory.`);
            }
            throw asError(err);
        }
    };

    // is root?
    if (path === dirname(path)) {
        return true;
    }

    try {
        await mkdir();
    } catch (err: unknown) {
        if (typeof err === "object" && err && (err as any).code !== "ENOENT") {
            throw asError(err);
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

export function isLoggedInExpo(): boolean {
    const loginPattern = /^\w+\s?$/g;
    const unloggedPattern = "Not logged in";
    const command = "expo w";
    const commandResult = execSync(command);
    if (commandResult.includes(unloggedPattern)) {
        SmokeTestLogger.warn(`Expo account is not logged in`);
        return false;
    }
    const matches = commandResult.match(loginPattern);
    if (matches && matches.length) {
        const login = matches[0].trim();
        SmokeTestLogger.success(`Logged in Expo as ${login}`);
        return true;
    }
    SmokeTestLogger.error(
        `There is an unrecognized command '${command}' result. Output of command: ${commandResult}`,
    );
    return false;
}

export function execSync(
    command: string,
    options: cp.ExecSyncOptions = {},
    logFilePath?: string,
): string {
    options = Object.assign(options, { stdio: "pipe" });
    let output = "";
    try {
        output = cp.execSync(quote([`${command}`]), options).toString();
    } catch (err: unknown) {
        // Try to extract stdout/stderr if present
        if (err && typeof err === "object") {
            const stdout = (err as any).stdout;
            const stderr = (err as any).stderr;
            if (stdout) output += stdout.toString();
            if (stderr) output += stderr.toString();
        }
        if (logFilePath) {
            SmokeTestLogger.saveLogsInFile(output, logFilePath);
        }
        throw asError(err);
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
        promises.forEach(promise => {
            promise
                .then(result => {
                    saveResult(result);
                })
                .catch(e => {
                    reject(e);
                });
        });
    });
}

// Await function
export async function sleep(time: number): Promise<void> {
    await new Promise<void>(resolve => {
        const timer = setTimeout(() => {
            clearTimeout(timer);
            resolve();
        }, time);
    });
}

export function findFile(directoryToSearch: string, filePattern: RegExp): string | null {
    const dirFiles = fs.readdirSync(directoryToSearch);
    let extensionFile = dirFiles.find(elem => {
        return filePattern.test(elem);
    });
    if (extensionFile) {
        return extensionFile;
    }
    return null;
}

export function filterProgressBarChars(str: string): string {
    const filterRegExp = /\||\/|\-|\\/g;
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

export async function smokeTestFail(message: string): Promise<void> {
    SmokeTestLogger.error(message);
}
