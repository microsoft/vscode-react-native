// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.

import {HostPlatform} from "./hostPlatform";
import {Crypto} from "./node/crypto";

export class MessagingHelper {
    public static getPath(projectRootPath: string): string {
        /* We need to use a different value for each VS Code window so the pipe names won't clash.
           We create the pipe path hashing the user id + project root path so both client and server
           will generate the same path, yet it's unique for each vs code instance */
        const userID = HostPlatform.getUserID();
        const normalizedRootPath = projectRootPath.toLowerCase();
        const uniqueSeed = `${userID}:${normalizedRootPath}`;
        const hash = new Crypto().hash(uniqueSeed);
        return HostPlatform.getPipePath(`vscode-reactnative-${hash}`);
    }
}
