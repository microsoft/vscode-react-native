// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.

import { ClientIdConstituents, ClientQuery } from "./clientDevice";

export enum ClientOS {
    iOS = "iOS",
    Android = "Android",
    Windows = "Windows",
    MacOS = "MacOS",
}

export function buildClientId(clientInfo: {
    app: string;
    os: ClientOS;
    device: string;
    device_id: string;
}): string {
    for (const key of ["app", "os", "device", "device_id"] as Array<keyof ClientIdConstituents>) {
        if (!clientInfo[key]) {
            console.error(`Attempted to build clientId with invalid ${key}: "${clientInfo[key]}`);
        }
    }
    const escapedName = escape(clientInfo.app);
    return `${escapedName}#${clientInfo.os}#${clientInfo.device}#${clientInfo.device_id}`;
}

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
