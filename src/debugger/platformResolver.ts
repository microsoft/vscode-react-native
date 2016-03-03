// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.

import {IRunOptions} from "../common/launchArgs";
import * as IOSPlatform from "./ios/iOSPlatform";
import * as AndroidPlatform from "./android/androidPlatform";

/**
 * Contains all the mobile platform specific debugging operations.
 */
export interface IAppPlatform {
    runApp(runOptions: IRunOptions): Q.Promise<void>;
    enableJSDebuggingMode(runOptions: IRunOptions): Q.Promise<void>;
}

export class PlatformResolver {

    /**
     * Resolves the mobile application target platform.
     */
    public resolveMobilePlatform(mobilePlatformString: string): IAppPlatform {
        switch (mobilePlatformString) {
            // We lazyly load the strategies, because some components might be
            // missing on some platforms (like XCode in Windows)
            case "ios":
                let ios: typeof IOSPlatform = require("./ios/iOSPlatform");
                return new ios.IOSPlatform();
            case "android":
                let android: typeof AndroidPlatform = require("./android/androidPlatform");
                return new android.AndroidPlatform();
            default:
                return null;
        }
    }
}