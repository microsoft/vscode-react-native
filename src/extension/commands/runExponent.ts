// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.

import { ErrorHelper } from "../../common/error/errorHelper";
import { InternalErrorCode } from "../../common/error/internalErrorCode";
import { ProjectVersionHelper } from "../../common/projectVersionHelper";
import { ExponentPlatform } from "../exponent/exponentPlatform";
import { PlatformType } from "../launchArgs";
import { getRunOptions, loginToExponent, selectProject } from "./util";
import { ReactNativeCommand } from "./util/reactNativeCommand";

export class RunExponent extends ReactNativeCommand {
    codeName = "runExponent";
    label = "Run Expo";
    error = ErrorHelper.getInternalError(InternalErrorCode.FailedToRunExponent);

    async baseFn() {
        this.project = await selectProject();

        const nodeModulesRoot = this.project.getOrUpdateNodeModulesRoot();
        const versions = await ProjectVersionHelper.getReactNativePackageVersionsFromNodeModules(
            nodeModulesRoot,
        );
        this.project.setReactNativeVersions(versions);

        const platform = new ExponentPlatform(getRunOptions(this.project, PlatformType.Exponent), {
            packager: this.project.getPackager(),
        });

        await platform.beforeStartPackager();
        await platform.startPackager();
        await platform.runApp();
    }

    async onBeforeExecute() {
        this.project = await selectProject();
        await loginToExponent(this.project);
    }
}
