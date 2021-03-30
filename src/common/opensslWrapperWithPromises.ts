// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.

import { exec as opensslWithCallback, Action } from "openssl-wrapper";
import * as child_process from "child_process";

export function openssl(action: Action, options: Record<string, any>): Promise<string> {
    return new Promise((resolve, reject) => {
        opensslWithCallback(action, options, (err, buffer) => {
            if (err) {
                reject(err);
            } else if (buffer) {
                resolve(buffer.toString());
            }
        });
    });
}

export function isInstalled(): boolean {
    return !child_process.spawnSync("openssl", ["version"]).error;
}
