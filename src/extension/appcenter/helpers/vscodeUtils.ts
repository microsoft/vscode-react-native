// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.

import { MessageTypes, ACConstants } from "../appCenterConstants";
import { StatusBarItem, window } from "vscode";

export interface IButtonMessageItem {
    title: string;
    url?: string;
    command?: string;
    telemetryId?: string;
}


export class VsCodeUtils {
    public static ShowInformationMessage(message: string): Q.Promise<void> {
        return this.showMessage(message, MessageTypes.Info);
    }

    public static ShowWarningMessage(message: string): Q.Promise<void> {
        return this.showMessage(message, MessageTypes.Warn);
    }

    public static ShowErrorMessage(message: string): Q.Promise<void> {
        return this.showMessage(message, MessageTypes.Error);
    }

    public static setStatusBar(statusBar: StatusBarItem, text: string, tooltip: string, commandOnClick?: string): Q.Promise<void>  {
        if (statusBar !== undefined) {
            statusBar.command = commandOnClick; // undefined clears the command
            statusBar.text = text;
            statusBar.tooltip = tooltip;
            statusBar.color = ACConstants.AppCenterCodePushStatusBarColor;
            statusBar.show();
        }
        return Q.resolve(void 0);
    }

    private static showMessage(messageToDisplay: string, type: MessageTypes): Q.Promise<void> {
        switch (type) {
            case MessageTypes.Error:
                window.showErrorMessage(messageToDisplay);
                break;
            case MessageTypes.Info:
                window.showWarningMessage(messageToDisplay);
                break;
            case MessageTypes.Error:
                window.showErrorMessage(messageToDisplay);
                break;
            default:
                break;
        }
        return Q.resolve(void 0);
    }
}