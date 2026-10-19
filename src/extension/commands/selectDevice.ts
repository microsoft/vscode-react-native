// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.

import { ErrorHelper } from "../../common/error/errorHelper";
import { InternalErrorCode } from "../../common/error/internalErrorCode";
import { DeviceSelector } from "../deviceSelector";
import { Command } from "./util/command";

export class SelectDevice extends Command {
    codeName = "selectDevice";
    label = "Select Device";
    requiresProject = false;
    error = ErrorHelper.getInternalError(InternalErrorCode.FailedToSelectDevice);

    async baseFn(): Promise<void> {
        await DeviceSelector.instance?.showPicker();
    }
}
