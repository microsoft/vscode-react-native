// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.

import {window, Disposable, StatusBarItem, StatusBarAlignment} from "vscode";

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
    private packagerStatusItem: StatusBarItem;
    private togglePackagerItem: StatusBarItem;
    private restartPackagerItem: StatusBarItem;
    private static PACKAGER_NAME: string = "React Native Packager";
    private static PACKAGER_STATUS_STOPPED: string = `${PackagerStatusIndicator.PACKAGER_NAME}: Stopped`;
    private static PACKAGER_STATUS_STOPPING: string = `${PackagerStatusIndicator.PACKAGER_NAME}: Stopping`;
    private static PACKAGER_STATUS_STARTED: string = `${PackagerStatusIndicator.PACKAGER_NAME}: Started`;
    private static PACKAGER_STATUS_STARTING: string = `${PackagerStatusIndicator.PACKAGER_NAME}: Starting`;

    private static START_ICON = "$(triangle-right)";
    private static STOP_ICON = "$(primitive-square)";
    private static RESTART_ICON = "$(sync)";
    private static ACTIVITY_ICON = "$(watch)";

    private static START_COMMAND = "reactNative.startPackager";
    private static STOP_COMMAND = "reactNative.stopPackager";
    private static RESTART_COMMAND = "reactNative.restartPackager";

    public constructor() {
        this.packagerStatusItem = window.createStatusBarItem(StatusBarAlignment.Left, 10);
        this.packagerStatusItem.text = PackagerStatusIndicator.PACKAGER_STATUS_STOPPED;
        this.packagerStatusItem.show();

        this.togglePackagerItem = window.createStatusBarItem(StatusBarAlignment.Left, 10);
        this.togglePackagerItem.text = PackagerStatusIndicator.START_ICON;
        this.togglePackagerItem.command = PackagerStatusIndicator.START_COMMAND;
        this.togglePackagerItem.tooltip = "Start Packager";
        this.togglePackagerItem.show();

        this.restartPackagerItem = window.createStatusBarItem(StatusBarAlignment.Left, 10);
        this.restartPackagerItem.text = PackagerStatusIndicator.RESTART_ICON;
        this.restartPackagerItem.command = PackagerStatusIndicator.RESTART_COMMAND;
        this.restartPackagerItem.tooltip = "Restart Packager";
        this.restartPackagerItem.show();

    }

    public dispose(): void {
        this.packagerStatusItem.dispose();
        this.togglePackagerItem.dispose();
        this.restartPackagerItem.dispose();
    }

    public updatePackagerStatus(status: PackagerStatus): void {
        switch (status) {
            case PackagerStatus.PACKAGER_STOPPED:
                this.packagerStatusItem.text = PackagerStatusIndicator.PACKAGER_STATUS_STOPPED;

                this.togglePackagerItem.text = PackagerStatusIndicator.START_ICON;
                this.togglePackagerItem.command = PackagerStatusIndicator.START_COMMAND;
                this.togglePackagerItem.tooltip = "Start Packager";

                this.restartPackagerItem.command = PackagerStatusIndicator.RESTART_COMMAND;
                break;
            case PackagerStatus.PACKAGER_STOPPING:
                this.packagerStatusItem.text = PackagerStatusIndicator.PACKAGER_STATUS_STOPPING;

                this.togglePackagerItem.text = PackagerStatusIndicator.ACTIVITY_ICON;
                this.togglePackagerItem.command = "";
                this.togglePackagerItem.tooltip = "";

                this.restartPackagerItem.command = "";
                break;
            case PackagerStatus.PACKAGER_STARTED:
                this.packagerStatusItem.text = PackagerStatusIndicator.PACKAGER_STATUS_STARTED;

                this.togglePackagerItem.text = PackagerStatusIndicator.STOP_ICON;
                this.togglePackagerItem.command = PackagerStatusIndicator.STOP_COMMAND;
                this.togglePackagerItem.tooltip = "Stop Packager";

                this.restartPackagerItem.command = PackagerStatusIndicator.RESTART_COMMAND;
                break;
            case PackagerStatus.PACKAGER_STARTING:
                this.packagerStatusItem.text = PackagerStatusIndicator.PACKAGER_STATUS_STARTING;

                this.togglePackagerItem.text = PackagerStatusIndicator.ACTIVITY_ICON;
                this.togglePackagerItem.command = "";
                this.togglePackagerItem.tooltip = "";

                this.restartPackagerItem.command = "";
                break;
            default:
                break;
        }
    }
}
