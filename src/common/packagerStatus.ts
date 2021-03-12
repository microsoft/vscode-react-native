// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.

import { Request } from "./node/request";

export function ensurePackagerRunning(
    packagerAddress: string,
    packagerPort: number,
    error: any,
): Promise<void> {
    let statusURL = `http://${packagerAddress}:${packagerPort}/status`;
    return Request.request(statusURL, true)
        .then((body: string) => {
            return body === "packager-status:running" ? Promise.resolve() : Promise.reject();
        })
        .catch(() => {
            return Promise.reject(error);
        });
}
