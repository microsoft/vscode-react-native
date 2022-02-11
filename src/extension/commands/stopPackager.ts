// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.

import * as assert from "assert";
import { ErrorHelper } from "../../common/error/errorHelper";
import { InternalErrorCode } from "../../common/error/internalErrorCode";
import { AppLauncher } from "../appLauncher";
import { ReactNativeCommand } from "./util/reactNativeCommand";

export class StopPackager extends ReactNativeCommand {
    codeName = "stopPackager";
    label = "Stop Packager";
    error = ErrorHelper.getInternalError(InternalErrorCode.FailedToStopPackager);

    // this function requires argument because we need it in extension 'deactivate' hook
    async baseFn() {
        const project = projectArg || this.project;
        assert(project);
        await project.getPackager().stop();
    }
}
