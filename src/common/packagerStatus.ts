// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.

import * as Q from "q";
import { Request } from "./node/request";

export function ensurePackagerRunning(packagerAddress: string, packagerPort: number, error: any): Q.Promise<void> {
    let statusURL = `http://${packagerAddress}:${packagerPort}/status`;
    return Request.request(statusURL, true)
        .then((body: string) => {
            return (body === "packager-status:running") ?
                Q.resolve(void 0) :
                Q.reject();
        })
        .catch(() => {
            return Q.reject(error);
        });
}
