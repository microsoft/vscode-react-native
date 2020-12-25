// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.

import * as Configstore from "configstore";

export class ExtensionConfigManager {
    private static configName = "reactNativeToolsConfig";
    public static readonly config = new Configstore(ExtensionConfigManager.configName);
}
