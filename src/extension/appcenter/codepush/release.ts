// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.

import { AppCenterClient, models } from "../api/index";
import { ILogger, LogLevel } from "../../log/LogHelper";
import { ICodePushReleaseParams } from "../command/commandParams";
import * as Q from "q";
import { CommandResult, success, failure, ErrorCodes } from "../command/commandResult";
import { appcenterCodePushRelease } from "./release-strategy/appcenterCodePushRelease";
import { legacyCodePushRelease } from "./release-strategy/legacyCodePushRelease";
import { SettingsHelper } from "../../settingsHelper";

// Use old service endpoint unless we will fix issue with 1MB payload limitation for new one
const useLegacyCodePushServer: boolean = SettingsHelper.getLegacyCodePushServiceEnabled();

export default class CodePushRelease {
    public static exec(client: AppCenterClient, params: ICodePushReleaseParams, logger: ILogger): Q.Promise<CommandResult> {
        return ((): Q.Promise<CodePushRelease> => {
            if (useLegacyCodePushServer) {
                return legacyCodePushRelease(params, <string>params.token, SettingsHelper.getLegacyCodePushEndpoint());
            } else {
                return appcenterCodePushRelease(client, params);
            }
        })().then((result: models.CodePushRelease) => {
            return success(result);
        }).catch((error) => {
            if (error && error.reposnse && error.response.statusCode === 409) {
                logger.log(error.response.body, LogLevel.Error);
                return failure(ErrorCodes.Exception, error.response.body);
            }

            logger.log("An error occured on doing Code Push release", LogLevel.Error);
            if (typeof error === "string") {
                return failure(ErrorCodes.Exception, error);
            } else {
                return failure(ErrorCodes.Exception, "An error occured on doing Code Push release");
            }
        });
    }
}