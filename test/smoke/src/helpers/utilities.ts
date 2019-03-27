// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.

import * as fs from "fs";
import * as cp from "child_process";
import { dirname } from "path";
import { SpawnSyncOptions } from "child_process";

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

                if (stat.isDirectory) {
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
        console.log(result.stdout);
    }
    if (result.stderr) {
        console.log(result.stderr);
    }
    if (result.error) {
        throw result.error;
    }
}