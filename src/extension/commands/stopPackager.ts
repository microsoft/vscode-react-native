// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.

import * as assert from "assert";
import { ErrorHelper } from "../../common/error/errorHelper";
import { InternalErrorCode } from "../../common/error/internalErrorCode";
import { ReactNativeCommand } from "./_util";

export class StopPackager extends ReactNativeCommand {
    codeName = "stopPackager";
    label = "Stop Packager";
    error = ErrorHelper.getInternalError(InternalErrorCode.FailedToStopPackager);

    async baseFn() {
        assert(this.project);
        await this.project.getPackager().stop();
    }
}
