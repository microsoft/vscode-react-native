// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.

import { window, Disposable, StatusBarItem, StatusBarAlignment } from "vscode";
import * as nls from "vscode-nls";
import { SettingsHelper } from "./settingsHelper";
nls.config({
    messageFormat: nls.MessageFormat.bundle,
    bundleFormat: nls.BundleFormat.standalone,
})();
const localize = nls.loadMessageBundle();

/**
 * Updates the Status bar with the status of React Native Packager.
 */

export enum PackagerStatus {
    PACKAGER_STOPPED,
    PACKAGER_STOPPING,
    PACKAGER_STARTED,
    PACKAGER_STARTING,
}

export class PackagerStatusIndicator implements Disposable {
    private togglePackagerItem: StatusBarItem;
    private restartPackagerItem: StatusBarItem;
    private displayVersion: string;
    private projectRoot?: string;

    private static PACKAGER_NAME: string = localize("ReactNativePackager", "React Native Packager");

    private static STOP_TOOLTIP: string = localize("StopPackager", "Stop Packager");
    private static START_TOOLTIP: string = localize("StartPackager", "Start Packager");
    private static RESTART_TOOLTIP: string = localize("RestartPackager", "Restart Packager");
    private static STARTING_TOOLTIP: string = localize("StartingPackager", "Starting Packager");
    private static STOPPING_TOOLTIP: string = localize("StoppingPackager", "Stopping Packager");

    private static START_ICON = "$(play)";
    private static STOP_ICON = "$(primitive-square)";
    private static ACTIVITY_ICON = "$(loading~spin)";
    private static RESTART_ICON = "$(sync)";

    private static START_COMMAND = "reactNative.startPackager";
    private static RESTART_COMMAND = "reactNative.restartPackager";
    private static STOP_COMMAND = "reactNative.stopPackager";

    public static FULL_VERSION = "Full";
    public static SHORT_VERSION = "Short";

    public constructor(projectRoot?: string) {
        this.projectRoot = projectRoot;

        this.restartPackagerItem = window.createStatusBarItem(StatusBarAlignment.Left, 10);
        this.restartPackagerItem.text = PackagerStatusIndicator.RESTART_ICON;
        this.restartPackagerItem.command = PackagerStatusIndicator.RESTART_COMMAND;
        this.restartPackagerItem.tooltip = PackagerStatusIndicator.RESTART_TOOLTIP;

        this.togglePackagerItem = window.createStatusBarItem(StatusBarAlignment.Left, 10);
        this.setupPackagerStatusIndicatorItems(
            PackagerStatusIndicator.START_ICON,
            PackagerStatusIndicator.START_COMMAND,
            PackagerStatusIndicator.START_TOOLTIP,
        );
    }

    public updateDisplayVersion(): void {
        this.displayVersion = PackagerStatusIndicator.FULL_VERSION;
        try {
            if (this.projectRoot) {
                this.displayVersion = SettingsHelper.getPackagerStatusIndicatorPattern(
                    this.projectRoot,
                );
            }
        } catch (e) {
            // We are trying to read the configuration from settings.json.
            // If this cannot be done, ignore the error and set the default value.
        }
    }

    public dispose(): void {
        this.togglePackagerItem.dispose();
        this.restartPackagerItem.dispose();
    }

    private setupPackagerStatusIndicatorItems(
        icon: string,
        command?: string,
        tooltip: string = "",
    ): void {
        this.updateDisplayVersion();
        this.togglePackagerItem.command = command;
        this.togglePackagerItem.tooltip = tooltip;
        switch (this.displayVersion) {
            case PackagerStatusIndicator.FULL_VERSION:
                this.togglePackagerItem.text = `${icon} ${PackagerStatusIndicator.PACKAGER_NAME}`;
                this.togglePackagerItem.show();
                this.restartPackagerItem.show();
                break;
            case PackagerStatusIndicator.SHORT_VERSION:
                this.togglePackagerItem.text = `${icon}`;
                this.togglePackagerItem.show();
                this.restartPackagerItem.hide();
                break;
        }
    }

    public updatePackagerStatus(status: PackagerStatus): void {
        switch (status) {
            case PackagerStatus.PACKAGER_STOPPED:
                this.setupPackagerStatusIndicatorItems(
                    PackagerStatusIndicator.START_ICON,
                    PackagerStatusIndicator.START_COMMAND,
                    PackagerStatusIndicator.START_TOOLTIP,
                );
                break;
            case PackagerStatus.PACKAGER_STOPPING:
                this.setupPackagerStatusIndicatorItems(
                    PackagerStatusIndicator.ACTIVITY_ICON,
                    undefined,
                    PackagerStatusIndicator.STOPPING_TOOLTIP,
                );
                break;
            case PackagerStatus.PACKAGER_STARTED:
                this.setupPackagerStatusIndicatorItems(
                    PackagerStatusIndicator.STOP_ICON,
                    PackagerStatusIndicator.STOP_COMMAND,
                    PackagerStatusIndicator.STOP_TOOLTIP,
                );
                break;
            case PackagerStatus.PACKAGER_STARTING:
                this.setupPackagerStatusIndicatorItems(
                    PackagerStatusIndicator.ACTIVITY_ICON,
                    undefined,
                    PackagerStatusIndicator.STARTING_TOOLTIP,
                );
                break;
            default:
                break;
        }
    }
}
