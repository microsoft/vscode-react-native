// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.

import { AppCenterClient, models } from "../api/index";
import { ILogger, LogLevel } from "../../log/LogHelper";
import { ICodePushReleaseParams } from "../command/commandParams";
import * as Q from "q";
import { CommandResult, success, failure, ErrorCodes } from "../command/commandResult";
import { appcenterCodePushRelease } from "./release-strategy/appcenterCodePushRelease";
import LegacyCodePushRelease from "./release-strategy/legacyCodePushRelease";

const useLegacyCodePushServer: boolean = true;

export default class CodePushRelease {
    public static exec(client: AppCenterClient, params: ICodePushReleaseParams, logger: ILogger): Q.Promise<CommandResult> {
        const app = params.app;
        return ((): Q.Promise<CodePushRelease> => {
            if (useLegacyCodePushServer) {
                return new LegacyCodePushRelease().release(client, app, params.deploymentName, params.updatedContentZipPath, {
                    appVersion: params.appVersion,
                    description: params.description,
                    isDisabled: params.isDisabled,
                    isMandatory: params.isMandatory,
                    rollout: params.rollout,
                }, <string>params.token, "https://codepush-management.azurewebsites.net/");
            } else {
                return appcenterCodePushRelease(client, params);
            }
        })().then((result: models.CodePushRelease) => {
            return success(result);
        }).catch((error) => {
            if (error.response.statusCode === 409) {
                logger.log(error.response.body, LogLevel.Error);
                return failure(ErrorCodes.Exception, error.response.body);
            }
            logger.log("An error occured on doing Code Push release", LogLevel.Error);
            return failure(ErrorCodes.Exception, "An error occured on doing Code Push release");
        });
    }
}