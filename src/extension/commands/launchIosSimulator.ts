// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.

import { ErrorHelper } from "../../common/error/errorHelper";
import { InternalErrorCode } from "../../common/error/internalErrorCode";
import { TargetType } from "../generalPlatform";
import { IOSTargetManager } from "../ios/iOSTargetManager";
import { Command } from "./util/command";

export class LaunchIOSSimulator extends Command {
    codeName = "launchIOSSimulator";
    label = "Launch iOS Simulator";
    requiresProject = false;

    error = ErrorHelper.getInternalError(InternalErrorCode.FailedToStartIOSSimulator);

    async baseFn() {
        const targetManager = new IOSTargetManager();
        await targetManager.collectTargets(TargetType.Simulator);
        await targetManager.selectAndPrepareTarget(target => target.isVirtualTarget);
    }
}
