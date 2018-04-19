// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.

import { AppCenterClient, models } from "../../api/index";
import { ICodePushReleaseParams } from "../../command/commandParams";
import { getQPromisifiedClientResult } from "../../api/createClient";
import * as fs from "fs";

export function appcenterCodePushRelease(client: AppCenterClient, params: ICodePushReleaseParams): Q.Promise<models.CodePushRelease> {
    const app = params.app;
    return getQPromisifiedClientResult(client.codepush.codePushDeploymentReleases.create(
        app.appName,
        params.deploymentName,
        app.ownerName,
        <string>params.appVersion,
        {
            packageProperty: fs.createReadStream(params.updatedContentZipPath),
            deploymentName: params.deploymentName,
            description: params.description,
            disabled: params.isDisabled,
            mandatory: params.isMandatory,
            noDuplicateReleaseError: false, // TODO: remove it, not needed to send to server
            rollout: params.rollout,
        })
    );
}