// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.

import * as assert from "assert";
import { ErrorHelper } from "../../common/error/errorHelper";
import { InternalErrorCode } from "../../common/error/internalErrorCode";
import { AdbHelper } from "../android/adb";
import { AndroidTargetManager } from "../android/androidTargetManager";
import { TargetType } from "../generalPlatform";
import { Command } from "./util/command";

// #todo> codeName differs from Class Name
export class LaunchAndroidEmulator extends Command {
    codeName = "launchAndroidSimulator";
    label = "Launch Android Emulator";
    error = ErrorHelper.getInternalError(InternalErrorCode.FailedToStartAndroidEmulator);

    async baseFn(): Promise<void> {
        assert(this.project);

        const projectPath = this.project.getPackager().getProjectPath();
        const nodeModulesRoot = this.project.getOrUpdateNodeModulesRoot();
        const adbHelper = new AdbHelper(projectPath, nodeModulesRoot);
        const androidEmulatorManager = new AndroidTargetManager(adbHelper);
        await androidEmulatorManager.collectTargets(TargetType.Simulator);
        await androidEmulatorManager.selectAndPrepareTarget(target => target.isVirtualTarget);
    }
}
