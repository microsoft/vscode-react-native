// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.

import * as nls from "vscode-nls";
import * as vscode from "vscode";
import { ErrorHelper } from "../../common/error/errorHelper";
import { InternalErrorCode } from "../../common/error/internalErrorCode";
import { AdbHelper } from "../android/adb";
import { AndroidTargetManager } from "../android/androidTargetManager";
import { LogCatMonitor } from "../android/logCatMonitor";
import { LogCatMonitorManager } from "../android/logCatMonitorManager";
import { TipNotificationService } from "../services/tipsNotificationsService/tipsNotificationService";
import { SettingsHelper } from "../settingsHelper";
import { OutputChannelLogger } from "../log/OutputChannelLogger";
import { Command } from "./util/command";
import { selectProject } from "./util";

nls.config({
    messageFormat: nls.MessageFormat.bundle,
    bundleFormat: nls.BundleFormat.standalone,
})();
const localize = nls.loadMessageBundle();

export class StartLogCatMonitor extends Command {
    codeName = "startLogCatMonitor";
    label = "Run React Native LogCat Monitor";
    requiresTrust = false;
    error = ErrorHelper.getInternalError(InternalErrorCode.AndroidCouldNotStartLogCatMonitor);

    async baseFn() {
        this.project = await selectProject();
        const logger = OutputChannelLogger.getMainChannel();

        void TipNotificationService.getInstance().setKnownDateForFeatureById("logCatMonitor");
        const projectPath = this.project.getPackager().getProjectPath();
        const nodeModulesRoot: string = this.project.getOrUpdateNodeModulesRoot();
        const adbHelper = new AdbHelper(projectPath, nodeModulesRoot);
        const targetManager = new AndroidTargetManager(adbHelper);
        const target = await targetManager.selectAndPrepareTarget(target => target.isOnline);

        if (!target) {
            void vscode.window.showErrorMessage(
                localize(
                    "OnlineAndroidDeviceNotFound",
                    "Could not find a proper online Android device to start a LogCat monitor",
                ),
            );
            return;
        }

        LogCatMonitorManager.delMonitor(target.id); // Stop previous logcat monitor if it's running
        const logCatArguments = SettingsHelper.getLogCatFilteringArgs(
            this.project.getWorkspaceFolderUri(),
        );
        // this.logCatMonitor can be mutated, so we store it locally too
        const logCatMonitor = new LogCatMonitor(target.id, adbHelper, logCatArguments);
        LogCatMonitorManager.addMonitor(logCatMonitor);
        logCatMonitor
            .start() // The LogCat will continue running forever, so we don't wait for it
            .catch(() =>
                logger.warning(
                    localize("ErrorWhileMonitoringLogCat", "Error while monitoring LogCat"),
                ),
            );
    }
}
