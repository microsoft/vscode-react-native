// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.

import * as assert from "assert";
import * as path from "path";
import * as fs from "fs";
import * as vscode from "vscode";
import * as nls from "vscode-nls";
import { ErrorHelper } from "../../common/error/errorHelper";
import { InternalErrorCode } from "../../common/error/internalErrorCode";
import { OutputChannelLogger } from "../log/OutputChannelLogger";
import { CommandExecutor } from "../../common/commandExecutor";
import { Command } from "./util/command";

nls.config({
    messageFormat: nls.MessageFormat.bundle,
    bundleFormat: nls.BundleFormat.standalone,
})();
const localize = nls.loadMessageBundle();

export class InstallPods extends Command {
    codeName = "installPods";
    label = "Install CocoaPods dependencies";
    requiresTrust = true;
    error = ErrorHelper.getInternalError(InternalErrorCode.FailedToInstallPods);

    async baseFn(): Promise<void> {
        assert(this.project);
        const logger = OutputChannelLogger.getMainChannel();

        // Check if running on macOS
        if (process.platform !== "darwin") {
            void vscode.window.showWarningMessage(
                localize("CocoaPodsOnlyMacOS", "CocoaPods is only supported on macOS."),
            );
            return;
        }

        const projectPath = this.project.getPackager().getProjectPath();
        const iosPath = path.join(projectPath, "ios");

        // Check if ios directory exists
        if (!fs.existsSync(iosPath)) {
            void vscode.window.showErrorMessage(
                localize(
                    "IOSDirectoryNotFound",
                    "iOS directory not found. Make sure this is a React Native project with iOS support.",
                ),
            );
            return;
        }

        // Check if Podfile exists
        const podfilePath = path.join(iosPath, "Podfile");
        if (!fs.existsSync(podfilePath)) {
            void vscode.window.showErrorMessage(
                localize("PodfileNotFound", "Podfile not found in the ios directory."),
            );
            return;
        }

        logger.info(localize("InstallingCocoaPods", "Installing CocoaPods dependencies..."));

        try {
            const commandExecutor = new CommandExecutor(
                this.project.getOrUpdateNodeModulesRoot(),
                projectPath,
                logger,
            );

            await commandExecutor.execute("pod install", { cwd: iosPath });

            void vscode.window.showInformationMessage(
                localize(
                    "CocoaPodsInstallSuccess",
                    "CocoaPods dependencies installed successfully.",
                ),
            );
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            const suggestion = this.getSuggestionForError(errorMessage);

            logger.error(
                localize("CocoaPodsInstallFailed", "Failed to install CocoaPods dependencies.") +
                    (suggestion ? ` ${suggestion}` : ""),
            );
            throw error;
        }
    }

    private getSuggestionForError(errorMessage: string): string {
        if (
            errorMessage.includes("command not found") ||
            errorMessage.includes("pod: not found") ||
            errorMessage.includes("'pod' is not recognized")
        ) {
            return localize(
                "SuggestionCocoaPodsNotInstalled",
                "CocoaPods may not be installed. Run 'sudo gem install cocoapods'.",
            );
        }
        if (errorMessage.includes("CDN") || errorMessage.includes("trunk.cocoapods.org")) {
            return localize("SuggestionCDNError", "CDN error. Try running 'pod repo update'.");
        }
        if (errorMessage.includes("Xcode") || errorMessage.includes("xcrun")) {
            return localize(
                "SuggestionXcodeError",
                "Xcode command line tools may be missing. Run 'xcode-select --install'.",
            );
        }
        if (errorMessage.includes("ruby") || errorMessage.includes("Ruby")) {
            return localize(
                "SuggestionRubyError",
                "Ruby environment issue. Check your Ruby installation.",
            );
        }
        if (errorMessage.includes("permission") || errorMessage.includes("Permission")) {
            return localize(
                "SuggestionPermissionError",
                "Permission denied. Try running with 'sudo' or check directory permissions.",
            );
        }
        return "";
    }
}
