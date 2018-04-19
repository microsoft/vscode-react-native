// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.

import LegacyCodePushServiceClient from "./legacyCodePushServiceClient";
import { models } from "../../api/index";
import { ICodePushReleaseParams } from "../../command/commandParams";
import { PackageInfo } from "./legacyCodePushServiceClient";
import * as Q from "q";

export function legacyCodePushRelease(params: ICodePushReleaseParams, token: string, serverUrl: string): Q.Promise<models.CodePushRelease> {
    const releaseData: PackageInfo = {
        description: params.description,
        isDisabled: params.isDisabled,
        isMandatory: params.isMandatory,
        rollout: params.rollout,
        appVersion: params.appVersion,
    };

    return new LegacyCodePushServiceClient(token, params.app, serverUrl)
        .release(params.deploymentName, params.updatedContentZipPath, releaseData);
}