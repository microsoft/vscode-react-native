// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.

declare class AppJson {
    public name: string;
    public displayName?: string;
    public expo?: ExpConfig;
}

declare class ExpConfig {
    public name: string;
    public slug: string;
    public sdkVersion: string;
    public version?: string;
    public entryPoint?: string;
    public packagerOpts?: ExpConfigPackager;
}

declare class ExpConfigPackager {
    public assetExts?: string[];
}