// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.

import * as os from "os";
import {ErrorHelper} from "./error/errorHelper";
import {HostPlatform} from "./hostPlatform";
import {InternalErrorCode} from "./error/internalErrorCode";
import * as nls from "vscode-nls";
const localize = nls.loadMessageBundle();
/**
 * Defines the identifiers of all the mobile target platforms React Native supports.
 */
export enum TargetPlatformId {
    ANDROID,
    IOS,
    EXPONENT,
    WINDOWS,
}

export class TargetPlatformHelper {
    /**
     * Return the target platform identifier for a platform with name {platformName}.
     */
    public static getTargetPlatformId(platformName: string): TargetPlatformId {
        switch (platformName.toLowerCase()) {
            case "android":
                return TargetPlatformId.ANDROID;
            case "ios":
                return TargetPlatformId.IOS;
            case "exponent":
                return TargetPlatformId.EXPONENT;
            case "windows":
            case "wpf":
                return TargetPlatformId.WINDOWS;
            default:
                throw new Error( localize("TargetPlatformIsNotSupported", "The target platform {0} is not supported.", platformName));
        }
    }

    /**
     * Checks whether the current host platform supports the target mobile platform.
     */
    public static checkTargetPlatformSupport(platformName: string): void {
        let targetPlatformId = TargetPlatformHelper.getTargetPlatformId(platformName);
        try {
            if (!HostPlatform.isCompatibleWithTarget(targetPlatformId)) {
                throw ErrorHelper.getInternalError(InternalErrorCode.PlatformNotSupported, platformName, os.platform());
            }
        } catch (e) {
            /* we throw in the case of an invalid target platform */
            throw ErrorHelper.getNestedError(e, InternalErrorCode.PlatformNotSupported, platformName, os.platform());
        }
    }
}
