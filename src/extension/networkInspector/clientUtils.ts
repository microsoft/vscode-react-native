// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.

import { ClientIdConstituents, ClientQuery } from "./clientDevice";
import { OutputChannelLogger } from "../log/OutputChannelLogger";

export enum ClientOS {
    iOS = "iOS",
    Android = "Android",
    Windows = "Windows",
    MacOS = "MacOS",
}

/**
 * @preserve
 * Start region: the code is borrowed from https://github.com/facebook/flipper/blob/v0.79.1/desktop/app/src/utils/clientUtils.tsx#L60-L78
 *
 * Copyright (c) Facebook, Inc. and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * @format
 */
export function buildClientId(
    clientInfo: {
        app: string;
        os: ClientOS;
        device: string;
        device_id: string;
    },
    logger: OutputChannelLogger,
): string {
    for (const key of ["app", "os", "device", "device_id"] as Array<keyof ClientIdConstituents>) {
        if (!clientInfo[key]) {
            logger.error(`Attempted to build clientId with invalid ${key}: "${clientInfo[key]}`);
        }
    }
    const escapedName = escape(clientInfo.app);
    return `${escapedName}#${clientInfo.os}#${clientInfo.device}#${clientInfo.device_id}`;
}

/**
 * @preserve
 * End region: https://github.com/facebook/flipper/blob/v0.79.1/desktop/app/src/utils/clientUtils.tsx#L60-L78
 */


/**
 * @preserve
 * Start region: the code is borrowed from https://github.com/facebook/flipper/blob/v0.79.1/desktop/app/src/server.tsx#L74-L83
 *
 * Copyright (c) Facebook, Inc. and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * @format
 */
export function appNameWithUpdateHint(query: ClientQuery): string {
    // in previous version (before 3), app may not appear in correct device
    // section because it refers to the name given by client which is not fixed
    // for android emulators, so it is indicated as outdated so that developers
    // might want to update SDK to get rid of this connection swap problem
    if (query.os === ClientOS.Android && (!query.sdk_version || query.sdk_version < 3)) {
        return query.app + " (Outdated SDK)";
    }
    return query.app;
}

/**
 * @preserve
 * End region: https://github.com/facebook/flipper/blob/v0.79.1/desktop/app/src/server.tsx#L74-L83
 */
