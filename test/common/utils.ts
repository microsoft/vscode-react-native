// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.

import * as rimraf from "rimraf";

export function rimrafAsync(path: string, options: rimraf.Options): Promise<void> {
    return new Promise((resolve, reject) => {
        rimraf(path, options, error => {
            if (error) {
                return reject(error);
            }
            return resolve();
        });
    });
}
