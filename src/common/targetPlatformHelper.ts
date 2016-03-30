// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.

/**
 * Defines the identifiers of all the mobile target platforms React Native supports.
 */
export enum TargetPlatformId {
    INVALID,
    ANDROID,
    IOS
}

/**
 * Return the target platform identifier for a platform with name {platformName}.
 */
export class TargetPlatformHelper {
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
}
