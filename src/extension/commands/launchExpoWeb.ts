// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.

import * as assert from "assert";
import { ErrorHelper } from "../../common/error/errorHelper";
import { InternalErrorCode } from "../../common/error/internalErrorCode";
import { PlatformType } from "../launchArgs";
import { AppLauncher } from "../appLauncher";
// import { GeneralPlatform } from "../generalPlatform";
import { getRunOptions } from "./util";
import { Command } from "./util/command";
import { ExponentPlatform } from "../exponent/exponentPlatform";

export class launchExpoWeb extends Command {
    codeName = "launchExpoWeb";
    label = "Launch ExpoWeb";
    error = ErrorHelper.getInternalError(InternalErrorCode.FailedToLaunchExpoWeb);

    async baseFn(launchArgs: any): Promise<any> {
        assert(this.project);
        await runExpoWeb(this.project);
    }
}

async function runExpoWeb(project: AppLauncher) {
    const platform = new ExponentPlatform(getRunOptions(project, PlatformType.ExpoWeb), {
        packager: project.getPackager(),
    });
    platform;

    await platform.beforeStartPackager();
    await platform.startPackager();
}
