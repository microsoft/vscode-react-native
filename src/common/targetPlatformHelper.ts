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
    INVALID,
    ANDROID,
    IOS
}

export class TargetPlatformHelper {
    /**
     * Return the target platform identifier for a platform with name {platformName}.
     */
    public static getTargetPlatformId(platformName: string): TargetPlatformId {
        let targetPlatformId: TargetPlatformId;
        switch (platformName) {
            case "android":
                targetPlatformId = TargetPlatformId.ANDROID;
                break;
            case "ios":
                targetPlatformId = TargetPlatformId.IOS;
                break;
            default:
                targetPlatformId = TargetPlatformId.INVALID;
                break;
            }

        return targetPlatformId;
    }

    /**
     * Checks whether the current host platform supports the target mobile platform.
     */
    public static checkTargetPlatformSupport(platformName: string): Q.Promise<void> {
        let targetPlatformId = TargetPlatformHelper.getTargetPlatformId(platformName);
        if (!HostPlatform.getTargetPlatformCompatibility(targetPlatformId)) {
            return Q.reject<void>(ErrorHelper.getInternalError(InternalErrorCode.PlatformNotSupported, platformName, os.platform()));
        } else {
            return Q.resolve<void>(void 0);
        }
    }
}
