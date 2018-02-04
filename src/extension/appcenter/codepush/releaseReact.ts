// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.

import { AppCenterClient, models } from "../api/index";
import { ILogger, LogLevel } from "../../log/LogHelper";
import { IDefaultCommandParams } from "../command/commandParams";
import { getQPromisifiedClientResult } from "../api/createClient";
import * as Q from "q";
import { CommandResult, success, failure, ErrorCodes } from "../command/commandResult";

export default class CodePushReleaseReact {
    public static exec(client: AppCenterClient, params: IDefaultCommandParams, logger: ILogger): Q.Promise<CommandResult> {
        const app = params.app;
        return getQPromisifiedClientResult(client.codepush.codePushDeployments.list(app.appName, app.ownerName)).then((result: models.Deployment[]) => {
            return success(result);
        }).catch((e) => {
            logger.log("An error occured on getting deployments", LogLevel.Error);
            return failure(ErrorCodes.Exception, "An error occured on getting deployments");
        });
    }
}