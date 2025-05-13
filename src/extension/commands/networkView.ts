// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.

import * as assert from "assert";
import * as vscode from "vscode";
import * as nls from "vscode-nls";
import { ErrorHelper } from "../../common/error/errorHelper";
import { InternalErrorCode } from "../../common/error/internalErrorCode";
import { OutputChannelLogger } from "../log/OutputChannelLogger";
import { wait } from "../../common/utils";
import { ReactNativeCommand } from "./util/reactNativeCommand";

nls.config({
    messageFormat: nls.MessageFormat.bundle,
    bundleFormat: nls.BundleFormat.standalone,
})();
const logger = OutputChannelLogger.getMainChannel();

export class NetworkView extends ReactNativeCommand {
    codeName = "toggleNetworkView";
    label = "Network View";
    error = ErrorHelper.getInternalError(InternalErrorCode.FailedToToggleNetworkView);

    async baseFn(): Promise<void> {
        assert(this.project);
        try {
            await wait();
            const value = await vscode.window.showQuickPick(["On", "Off"], {
                placeHolder: "Enable or disable Network View.",
            });

            if (value) {
                const config = vscode.workspace.getConfiguration("debug.javascript");
                await config.update(
                    "enableNetworkView",
                    value === "On",
                    vscode.ConfigurationTarget.Global,
                );

                if (value === "On") {
                    await vscode.window.showInformationMessage("Network View has been enabled.");
                    logger.info("Network View has been enabled. You can view info from debug tab.");
                } else {
                    await vscode.window.showInformationMessage("Network View has been disabled.");
                    logger.info("Network View has been disabled.");
                }
            } else {
                return;
            }
        } catch (error) {
            await vscode.window.showErrorMessage("Failed to enable Network View");
            logger.info(`Failed to enable Network View: ${error}`);
        }
    }
}
