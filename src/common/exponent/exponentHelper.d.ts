// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.

declare class ExpConfig {
    name: string;
    slug: string;
    sdkVersion: string;
    version?: string;
    packagerOpts?: ExpConfigPackager;
}

declare class ExpConfigPackager {
    assetExts? : string[];
}