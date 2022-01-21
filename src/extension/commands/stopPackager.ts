// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.

import { ErrorHelper } from "../../common/error/errorHelper";
import { InternalErrorCode } from "../../common/error/internalErrorCode";
import { ReactNativeCommand, selectProject } from "./_util";

export class StopPackager extends ReactNativeCommand {
    codeName = "stopPackager";
    label = "Stop Packager";
    error = ErrorHelper.getInternalError(InternalErrorCode.FailedToStopPackager);

    async baseFn() {
        const appLauncher = await selectProject();

        await appLauncher.getPackager().stop();
    }
}
