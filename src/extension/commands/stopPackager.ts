// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.

import { ErrorHelper } from "../../common/error/errorHelper";
import { InternalErrorCode } from "../../common/error/internalErrorCode";
import { AppLauncher } from "../appLauncher";
import { selectProject } from "./util";
import { ReactNativeCommand } from "./util/reactNativeCommand";
import * as assert from "assert";

export class StopPackager extends ReactNativeCommand {
    codeName = "stopPackager";
    label = "Stop Packager";
    error = ErrorHelper.getInternalError(InternalErrorCode.FailedToStopPackager);

    requiresProject = false;

    async onBeforeExecute(appLauncher: AppLauncher) {
        this.project = appLauncher || (await selectProject());
    }

    // this function requires argument because we need it in extension 'deactivate' hook
    async baseFn() {
        assert(this.project);
        await this.project.getPackager().stop();
    }
}
