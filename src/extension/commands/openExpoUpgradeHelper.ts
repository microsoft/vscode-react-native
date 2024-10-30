// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.

import * as assert from "assert";
import * as vscode from "vscode";
import { OutputChannelLogger } from "../log/OutputChannelLogger";
import { ErrorHelper } from "../../common/error/errorHelper";
import { InternalErrorCode } from "../../common/error/internalErrorCode";
import { Command } from "./util/command";

const logger = OutputChannelLogger.getMainChannel();

export class openExpoUpgradeHelper extends Command {
    codeName = "openExpoUpgradeHelper";
    label = "Open expo upgrade helper in web page";
    error = ErrorHelper.getInternalError(InternalErrorCode.FailedToOpenExpoUpgradeHelper);

    async baseFn(): Promise<void> {
        assert(this.project);
        const ExpoUrl = "https://docs.expo.dev/bare/upgrade";
        logger.info("Open expo upgrade helper in web browser.");
        await vscode.env.openExternal(vscode.Uri.parse(ExpoUrl));
    }
}
