// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.

import * as assert from "assert";
import { ErrorHelper } from "../../common/error/errorHelper";
import { InternalErrorCode } from "../../common/error/internalErrorCode";
import { AppLauncher } from "../appLauncher";
import { ReactNativeCommand } from "./util/reactNativeCommand";

export class StopPackager extends ReactNativeCommand<[AppLauncher]> {
    codeName = "stopPackager";
    label = "Stop Packager";
    error = ErrorHelper.getInternalError(InternalErrorCode.FailedToStopPackager);

    requiresProject = false;
    requiresTrust = false;

    async onBeforeExecute(appLauncher: AppLauncher): Promise<void> {
        await super.onBeforeExecute(appLauncher);
        if (appLauncher instanceof AppLauncher) {
            this.project = appLauncher;
        } else {
            this.project = await this.selectProject();
        }
    }

    // this function requires argument because we need it in extension 'deactivate' hook
    async baseFn(): Promise<void> {
        assert(this.project);
        await this.project.getPackager()?.stop();
    }
}
