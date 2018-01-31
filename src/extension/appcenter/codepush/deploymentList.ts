// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.

import { AppCenterClient, models } from "../api/index";
import { ILogger, LogLevel } from "../../log/LogHelper";
import { IDefaultCommandParams } from "../command/commandParams";
import { getQPromisifiedClientResult } from "../api/createClient";
import * as Q from "q";

export default class CodePushDeploymentList {
    public static exec(client: AppCenterClient, params: IDefaultCommandParams, logger: ILogger): Q.Promise<void> {
        const app = params.app;
        return getQPromisifiedClientResult(client.codepush.codePushDeployments.list(app.appName, app.ownerName)).then((result: models.Deployment[]) => {
            return Q.resolve(null);
        }).catch((e) => {
            return logger.log("An error occured on getting deployments", LogLevel.Error);
        });
    }
}