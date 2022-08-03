// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.

import { CancellationTokenSource } from "vscode";
import { PromiseUtil } from "../../common/node/promise";
import { Request } from "../../common/node/request";

// eslint-disable-next-line @typescript-eslint/no-empty-interface
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
    return PromiseUtil.retryAsync(
        async () => {
            try {
                return await downloadConfig<T>(endpointURL);
            } catch (err) {
                return;
            }
        },
        (config: any) => !!config,
        retryCount,
        2000,
        `Could not download remote config from ${endpointURL}`,
        cancellationTokenSource,
    );
}
