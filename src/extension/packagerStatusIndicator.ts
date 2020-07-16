// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.

import {window, Disposable, StatusBarItem, StatusBarAlignment} from "vscode";
import * as nls from "vscode-nls";
nls.config({ messageFormat: nls.MessageFormat.bundle, bundleFormat: nls.BundleFormat.standalone })();
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
    private static PACKAGER_NAME: string = localize("ReactNativePackager", "React Native Packager");

    private static START_ICON = "$(triangle-right)";
    private static STOP_ICON = "$(primitive-square)";
    private static ACTIVITY_ICON = "$(tree-item-loading)";

    private static START_COMMAND = "reactNative.startPackager-preview";
    private static STOP_COMMAND = "reactNative.stopPackager-preview";

    public constructor() {
        this.togglePackagerItem = window.createStatusBarItem(StatusBarAlignment.Left, 10);
        this.togglePackagerItem.text = `${PackagerStatusIndicator.START_ICON} ${PackagerStatusIndicator.PACKAGER_NAME}`;
        this.togglePackagerItem.command = PackagerStatusIndicator.START_COMMAND;
        this.togglePackagerItem.tooltip = localize("StartPackager", "Start Packager");
        this.togglePackagerItem.show();
    }

    public dispose(): void {
        this.togglePackagerItem.dispose();
    }

    public updatePackagerStatus(status: PackagerStatus): void {
        switch (status) {
            case PackagerStatus.PACKAGER_STOPPED:
                this.togglePackagerItem.text =  `${PackagerStatusIndicator.START_ICON} ${PackagerStatusIndicator.PACKAGER_NAME}`;
                this.togglePackagerItem.command = PackagerStatusIndicator.START_COMMAND;
                this.togglePackagerItem.tooltip = localize("StartPackager", "Start Packager");
                break;
            case PackagerStatus.PACKAGER_STOPPING:
                this.togglePackagerItem.text =  `${PackagerStatusIndicator.ACTIVITY_ICON} ${PackagerStatusIndicator.PACKAGER_NAME}`;
                this.togglePackagerItem.command = undefined;
                this.togglePackagerItem.tooltip = "";
                break;
            case PackagerStatus.PACKAGER_STARTED:
                this.togglePackagerItem.text =  `${PackagerStatusIndicator.STOP_ICON} ${PackagerStatusIndicator.PACKAGER_NAME}`;
                this.togglePackagerItem.command = PackagerStatusIndicator.STOP_COMMAND;
                this.togglePackagerItem.tooltip = localize("StopPackager", "Stop Packager");
                break;
            case PackagerStatus.PACKAGER_STARTING:
                this.togglePackagerItem.text =  `${PackagerStatusIndicator.ACTIVITY_ICON} ${PackagerStatusIndicator.PACKAGER_NAME}`;
                this.togglePackagerItem.command = undefined;
                this.togglePackagerItem.tooltip = "";
                break;
            default:
                break;
        }
    }
}
