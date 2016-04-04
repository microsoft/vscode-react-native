// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.

import * as os from "os";
import * as Q from "q";
import {ErrorHelper} from "../common/error/errorHelper";
import {HostPlatform} from "../common/hostPlatform";
import {InternalErrorCode} from "../common/error/internalErrorCode";

/**
 * Defines the identifiers of all the mobile target platforms React Native supports.
 */
export enum TargetPlatformId {
    ANDROID,
    IOS
}

export class TargetPlatformHelper {
    /**
     * Return the target platform identifier for a platform with name {platformName}.
     */
    public static getTargetPlatformId(platformName: string): TargetPlatformId {
        switch (platformName) {
            case "android":
                return TargetPlatformId.ANDROID;
            case "ios":
                return TargetPlatformId.IOS;
            default:
                throw new Error("The target platform is not supported.");
        }
    }

    /**
     * Checks whether the current host platform supports the target mobile platform.
     */
    public static checkTargetPlatformSupport(platformName: string): Q.Promise<void> {
        let targetPlatformId = TargetPlatformHelper.getTargetPlatformId(platformName);
        try {
            if (!HostPlatform.isCompatibleWithTarget(targetPlatformId)) {
                return Q.reject<void>(ErrorHelper.getInternalError(InternalErrorCode.PlatformNotSupported, platformName, os.platform()));
            } else {
                return Q.resolve<void>(void 0);
            }
        } catch (e) {
            /* we throw in the case of an invalid target platform */
            return Q.reject<void>(ErrorHelper.getInternalError(InternalErrorCode.PlatformNotSupported, platformName, os.platform()));
        }
    }
}
