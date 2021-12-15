/* eslint-disable */
/* eslint-enable prettier/prettier*/

/**
 * Copyright (c) Facebook, Inc. and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * @format
 */

import * as child_process from "child_process";
import { exec as opensslWithCallback, Action } from "openssl-wrapper";

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
/* eslint-enable header/header */
