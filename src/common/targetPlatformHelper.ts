// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.

import * as os from "os";
import { PlatformType } from "../extension/launchArgs";
import { ErrorHelper } from "./error/errorHelper";
import { HostPlatform } from "./hostPlatform";
import { InternalErrorCode } from "./error/internalErrorCode";
/**
 * Defines the identifiers of all the mobile target platforms React Native supports.
 */
export enum TargetPlatformId {
    ANDROID,
    IOS,
    EXPONENT,
    WINDOWS,
    MACOS,
}

export class TargetPlatformHelper {
    /**
     * Return the target platform identifier for a platform with name {platformName}.
     */
    public static getTargetPlatformId(platformName: string): TargetPlatformId {
        switch (platformName.toLowerCase()) {
            case PlatformType.Android:
                return TargetPlatformId.ANDROID;
            case PlatformType.iOS:
                return TargetPlatformId.IOS;
            case PlatformType.Exponent:
                return TargetPlatformId.EXPONENT;
            case PlatformType.Windows:
                return TargetPlatformId.WINDOWS;
            case PlatformType.macOS:
                return TargetPlatformId.MACOS;
            default:
                throw ErrorHelper.getInternalError(
                    InternalErrorCode.PlatformNotSupported,
                    platformName,
                    os.platform(),
                );
        }
    }

    /**
     * Checks whether the current host platform supports the target mobile platform.
     */
    public static checkTargetPlatformSupport(platformName: string): void {
        const targetPlatformId = TargetPlatformHelper.getTargetPlatformId(platformName);
        if (!HostPlatform.isCompatibleWithTarget(targetPlatformId)) {
            throw ErrorHelper.getInternalError(
                InternalErrorCode.PlatformNotSupported,
                platformName,
                os.platform(),
            );
        }
    }
}
