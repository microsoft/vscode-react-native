// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.

import LegacyCodePushServiceClient from "./legacyCodePushServiceClient";
import { AppCenterClient, models } from "../../api/index";
import { DefaultApp } from "../../command/commandParams";
import { PackageInfo } from "./legacyCodePushServiceClient";
import * as Q from "q";

export default class LegacyCodePushRelease {
    public release(client: AppCenterClient, app: DefaultApp, deploymentName: string, updateContentsZipPath: string, updateMetadata:
        {
            appVersion?: string;
            description?: string;
            isDisabled?: boolean;
            isMandatory?: boolean;
            rollout?: number;
        },         token: string, serverUrl?: string): Q.Promise<models.CodePushRelease> {

        const releaseData: PackageInfo = {
            description: updateMetadata.description,
            isDisabled: updateMetadata.isDisabled,
            isMandatory: updateMetadata.isMandatory,
            rollout: updateMetadata.rollout,
            appVersion: updateMetadata.appVersion,
        };

        return new LegacyCodePushServiceClient(token, app)
            .release(deploymentName, updateContentsZipPath, releaseData);
    }
}