// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.

declare interface AppJson {
    name: string;
    displayName?: string;
    expo: ExpConfig;
}

declare interface ExpConfig {
    name: string;
    slug: string;
    sdkVersion: string;
    version?: string;
    entryPoint?: string;
    packagerOpts?: ExpConfigPackager;
    android?: [];
    ios?: [];
    web?: [];
}

declare interface ExpMetroConfig {
    sourceExts?: string[];
}
