// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.

import { AppCenterClient, models } from "../api/index";
import { ILogger, LogLevel } from "../../log/LogHelper";
import { ICodePushReleaseParams } from "../command/commandParams";
import { getQPromisifiedClientResult } from "../api/createClient";
import * as Q from "q";
import { CommandResult, success, failure, ErrorCodes } from "../command/commandResult";

export default class CodePushReleaseReact {
    public static exec(client: AppCenterClient, params: ICodePushReleaseParams, logger: ILogger): Q.Promise<CommandResult> {
        const app = params.app;
        return getQPromisifiedClientResult(client.codepush.codePushDeploymentReleases.create(
                app.appName,
                params.deploymentName,
                app.ownerName,
                <string>params.appVersion,
                {
                  deploymentName: params.deploymentName,
                  description: params.description,
                  disabled: params.isDisabled,
                  mandatory: params.isMandatory,
                  noDuplicateReleaseError: false, // TODO: remove it, not needed to send to server
                  rollout: params.rollout,
                })
        ).then((result: models.CodePushRelease) => {
            return success(result);
        }).catch((e) => {
            logger.log("An error occured on doing Code Push release", LogLevel.Error);
            return failure(ErrorCodes.Exception, "An error occured on doing Code Push release");
        });
    }
}