// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.

import * as assert from "assert";
import { ErrorHelper } from "../../common/error/errorHelper";
import { InternalErrorCode } from "../../common/error/internalErrorCode";
import { sendMessageToMetro } from "./util";
import { Command } from "./util/command";

export class ReloadApp extends Command {
    codeName = "reloadApp";
    requiresTrust = false;
    label = "ReloadApp";
    error = ErrorHelper.getInternalError(
        InternalErrorCode.CommandFailed,
        "React Native: Reload App",
    );

    async baseFn(): Promise<void> {
        await this.reloadApp();
    }
    public async reloadApp(): Promise<void> {
        assert(this.project);
        await sendMessageToMetro("reload", this.project);
    }
}
