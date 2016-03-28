// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.

import {HostPlatform} from "./hostPlatform";

/**
 * Defines the messages sent to the extension.
 * Add new messages to this enum.
 */
export enum ExtensionMessage {
    START_PACKAGER,
    STOP_PACKAGER,
    PREWARM_BUNDLE_CACHE,
    START_MONITORING_LOGCAT,
    STOP_MONITORING_LOGCAT
}

export interface MessageWithArguments {
    message: ExtensionMessage;
    args: any[];
}

export let ErrorMarker = "vscodereactnative-error-marker";

export class MessagingChannel {
    public getPath(): string {
        return HostPlatform.getExtensionPipePath();
    }
}
