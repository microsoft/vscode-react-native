// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.

import { ErrorHelper } from "../../common/error/errorHelper";
import { InternalErrorCode } from "../../common/error/internalErrorCode";
import { ProjectVersionHelper } from "../../common/projectVersionHelper";
import { TargetPlatformHelper } from "../../common/targetPlatformHelper";
import { AppLauncher } from "../appLauncher";
import { TargetType } from "../generalPlatform";
import { IOSPlatform } from "../ios/iOSPlatform";
import { PlatformType } from "../launchArgs";
import { getRunOptions, selectProject } from "./util";
import { ReactNativeCommand } from "./util/reactNativeCommand";

abstract class RunIos extends ReactNativeCommand {
    error = ErrorHelper.getInternalError(InternalErrorCode.FailedToRunOnIos);
    async onBeforeExecute() {
        this.project = await selectProject();
        const nodeModulesRoot = this.project.getOrUpdateNodeModulesRoot();
        const versions = await ProjectVersionHelper.getReactNativePackageVersionsFromNodeModules(
            nodeModulesRoot,
        );
        this.project.setReactNativeVersions(versions);
        TargetPlatformHelper.checkTargetPlatformSupport(PlatformType.iOS);
    }
}

export class RunIosDevice extends RunIos {
    codeName = "runIosDevice";
    label = "Run iOS on Device";

    async baseFn() {
        this.project = await selectProject();
        await runIos(TargetType.Device, this.project);
    }
}

export class RunIosSimulator extends RunIos {
    codeName = "runIosSimulator";
    label = "Run iOS on Simulator";

    async baseFn() {
        this.project = await selectProject();
        await runIos(TargetType.Simulator, this.project);
    }
}

async function runIos(target: TargetType, project: AppLauncher) {
    const platform = new IOSPlatform(getRunOptions(project, PlatformType.iOS, target), {
        packager: project.getPackager(),
    });

    try {
        await platform.resolveMobileTarget(target);
        await platform.beforeStartPackager();
        await platform.startPackager();
        // Set the Debugging setting to disabled, because in iOS it's persisted across runs of the app
        await platform.disableJSDebuggingMode();
    } catch (e) {} // If setting the debugging mode fails, we ignore the error and we run the run ios command anyways

    await platform.runApp();
}
