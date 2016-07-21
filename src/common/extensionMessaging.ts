// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.

import {HostPlatform} from "./hostPlatform";
import {Crypto} from "./node/crypto";

/**
 * Defines the messages sent to the extension.
 * Add new messages to this enum.
 */
export enum ExtensionMessage {
    START_PACKAGER,
    STOP_PACKAGER,
    PREWARM_BUNDLE_CACHE,
    START_MONITORING_LOGCAT,
    STOP_MONITORING_LOGCAT,
    GET_PACKAGER_PORT,
    SEND_TELEMETRY,
    OPEN_FILE_AT_LOCATION,
    START_EXPONENT_PACKAGER,
}

export interface MessageWithArguments {
    message: ExtensionMessage;
    args?: any[];
}

export let ErrorMarker = "vscodereactnative-error-marker";

export class MessagingChannel {
    constructor(private projectRootPath: string) {
        // Nothing needed here
    }

    public getPath(): string {
        /* We need to use a different value for each VS Code window so the pipe names won't clash.
           We create the pipe path hashing the user id + project root path so both client and server
           will generate the same path, yet it's unique for each vs code instance */
        const userID = HostPlatform.getUserID();
        const normalizedRootPath = this.projectRootPath.toLowerCase();
        const uniqueSeed = `${userID}:${normalizedRootPath}`;
        const hash = new Crypto().hash(uniqueSeed);
        return HostPlatform.getPipePath(`vscode-reactnative-${hash}`);
    }
}
