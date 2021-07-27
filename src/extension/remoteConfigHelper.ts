// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.

import { CancellationTokenSource } from "vscode";
import { PromiseUtil } from "../common/node/promise";
import { Request } from "../common/node/request";

export interface IConfig {}

export async function downloadConfig<T extends IConfig | IConfig[]>(
    endpointURL: string,
): Promise<T> {
    const resString = await Request.request(endpointURL, false, true);
    return JSON.parse(resString);
}

export async function retryDownloadConfig<T extends IConfig | IConfig[]>(
    endpointURL: string,
    cancellationTokenSource: CancellationTokenSource,
    retryCount = 60,
): Promise<T> {
    try {
        return await downloadConfig<T>(endpointURL);
    } catch (err) {
        if (retryCount < 1 || cancellationTokenSource.token.isCancellationRequested) {
            throw err;
        }

        await PromiseUtil.delay(2000);
        return await retryDownloadConfig(endpointURL, cancellationTokenSource, --retryCount);
    }
}
