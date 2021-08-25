// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.

import { Request } from "./node/request";

export async function ensurePackagerRunning(
    packagerAddress: string,
    packagerPort: number,
    error: any,
): Promise<void> {
    let statusURL = `http://${packagerAddress}:${packagerPort}/status`;
    try {
        const body = await Request.request(statusURL, true);
        if (body !== "packager-status:running") {
            return Promise.reject();
        }
    } catch {
        throw error;
    }
}
