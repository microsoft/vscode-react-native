// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.

import {IRunOptions} from "../common/launchArgs";
import {IOSPlatform} from "./ios/iOSPlatform";
import {AndroidPlatform} from "../common/android/androidPlatform";
import {GeneralMobilePlatform} from "./generalMobilePlatform";

export class PlatformResolver {

    /**
     * Resolves the mobile application target platform.
     */
    public resolveMobilePlatform(mobilePlatformString: string, runOptions: IRunOptions): GeneralMobilePlatform {
        switch (mobilePlatformString) {
            // We lazyly load the strategies, because some components might be
            // missing on some platforms (like XCode in Windows)
            case "ios":
                return new IOSPlatform(runOptions);
            case "android":
                return new AndroidPlatform(runOptions);
            default:
                return new GeneralMobilePlatform(runOptions);
        }
    }
}