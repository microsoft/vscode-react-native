// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.

import { IRunOptions, PlatformType } from "./launchArgs";
import { IOSPlatform } from "./ios/iOSPlatform";
import { AndroidPlatform } from "./android/androidPlatform";
import { WindowsPlatform } from "./windows/windowsPlatform";
import { GeneralMobilePlatform, MobilePlatformDeps } from "../extension/generalMobilePlatform";
import { ExponentPlatform } from "./exponent/exponentPlatform";
import { MacOSPlatform } from "./macos/macOSPlatform";

export class PlatformResolver {
    /**
     * Resolves the mobile application target platform.
     */
    public resolveMobilePlatform(
        mobilePlatformString: string,
        runOptions: IRunOptions,
        platformDeps: MobilePlatformDeps,
        nodeModulesRoot: string,
    ): GeneralMobilePlatform {
        switch (mobilePlatformString) {
            // We lazyly load the strategies, because some components might be
            // missing on some platforms (like XCode in Windows)
            case PlatformType.iOS:
                return new IOSPlatform(runOptions, platformDeps, nodeModulesRoot);
            case PlatformType.Android:
                return new AndroidPlatform(runOptions, platformDeps, nodeModulesRoot);
            case PlatformType.Exponent:
                return new ExponentPlatform(runOptions, platformDeps, nodeModulesRoot);
            case PlatformType.Windows:
                return new WindowsPlatform(runOptions, platformDeps, nodeModulesRoot);
            case PlatformType.macOS:
                return new MacOSPlatform(runOptions, platformDeps, nodeModulesRoot);
            default:
                return new GeneralMobilePlatform(runOptions, platformDeps, nodeModulesRoot);
        }
    }
}
