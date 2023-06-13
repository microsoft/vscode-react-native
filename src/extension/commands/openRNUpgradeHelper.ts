// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.

import * as assert from "assert";
import * as nls from "vscode-nls";
import * as vscode from "vscode";
import { OutputChannelLogger } from "../log/OutputChannelLogger";
import { ErrorHelper } from "../../common/error/errorHelper";
import { InternalErrorCode } from "../../common/error/internalErrorCode";
import { wait } from "../../common/utils";
import { Command } from "./util/command";

nls.config({
    messageFormat: nls.MessageFormat.bundle,
    bundleFormat: nls.BundleFormat.standalone,
})();
const localize = nls.loadMessageBundle();
const logger = OutputChannelLogger.getMainChannel();

export class OpenRNUpgradeHelper extends Command {
    codeName = "openRNUpgradeHelper";
    label = "Open react native upgrade helper in web page";
    error = ErrorHelper.getInternalError(InternalErrorCode.FailedToOpenRNUpgradeHelper);

    async baseFn(): Promise<void> {
        assert(this.project);
        const RNUrl =
            "https://react-native-community.github.io/upgrade-helper/?package=react-native";
        const RNWUrl =
            "https://react-native-community.github.io/upgrade-helper/?package=react-native-windows&language=cpp";
        const RNMUrl =
            "https://react-native-community.github.io/upgrade-helper/?package=react-native-macos";

        await wait();
        const item = await vscode.window.showQuickPick(
            ["React Native", "React Native Windows", "React Native MacOS"],
            {
                placeHolder: "Select type for your react native project",
            },
        );

        logger.info(
            localize("OpenInWebBrowser", "Open react native upgrade helper in web browser."),
        );

        switch (item) {
            case "React Native":
                await vscode.env.openExternal(vscode.Uri.parse(RNUrl));
                break;
            case "React Native Windows":
                await vscode.env.openExternal(vscode.Uri.parse(RNWUrl));
                break;
            case "React Native MacOS":
                await vscode.env.openExternal(vscode.Uri.parse(RNMUrl));
                break;
            default:
        }
    }
}
