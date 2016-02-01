// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.

/**
 * Contains all the mobile platform specific debugging operations.
 */
export interface IMobilePlatform {
    runApp(): Q.Promise<void>;
    enableJSDebuggingMode(): Q.Promise<void>;
}

/**
 * Contains all the desktop platform specific operations.
 */
export interface IDesktopPlatform {
    reactNativeCommandName: string;
    reactPackagerExtraParameters: string[];
}

export class PlatformResolver {

    /**
     * Resolves the dev machine, desktop platform.
     */
    public resolveDesktopPlatform(): IDesktopPlatform {
        let platform = process.platform;
        switch (platform) {
            case "darwin":
                return { reactNativeCommandName: "react-native", reactPackagerExtraParameters: [] };
            case "win32":
            default:
                return { reactNativeCommandName: "react-native.cmd", reactPackagerExtraParameters: ["--nonPersistent"] };
        }
    }

    /**
     * Resolves the mobile application target platform.
     */
    public resolveMobilePlatform(mobilePlatformString: string): IMobilePlatform {
        switch (mobilePlatformString) {
            // We lazyly load the strategies, because some components might be
            // missing on some platforms (like XCode in Windows)
            case "ios":
                let ios = require("./iOSPlatform");
                return new ios.IOSPlatform();
            case "android":
                let android = require("./androidPlatform");
                return new android.AndroidPlatform();
            default:
                return null;
        }
    }
}