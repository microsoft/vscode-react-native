// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.

import { MessageTypes, ACConstants } from "../appCenterConstants";
import { commands, StatusBarItem, window, MessageItem, extensions } from "vscode";
import { ACUtils } from "./utils";
import * as Q from "q";

export interface IButtonMessageItem {
    title: string;
    url?: string;
    command?: string;
}

export class ButtonMessageItem implements MessageItem, IButtonMessageItem {
    public title: string;
    public url?: string;
    public command?: string;
}

export class VsCodeUtils {
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

    public static ShowInformationMessage(message: string, ...urlMessageItem: IButtonMessageItem[]): Q.Promise<IButtonMessageItem | undefined> {
        return Q.Promise<IButtonMessageItem | undefined>((resolve, reject) => {
            return this.showMessage(message, MessageTypes.Info, ...urlMessageItem).then((res: IButtonMessageItem | undefined) => {
                resolve(res);
                return;
            });
        });
    }

    public static ShowWarningMessage(message: string, ...urlMessageItem: IButtonMessageItem[]): Q.Promise<IButtonMessageItem | undefined> {
        return Q.Promise<IButtonMessageItem | undefined>((resolve, reject) => {
            return this.showMessage(message, MessageTypes.Warn, ...urlMessageItem).then((res: IButtonMessageItem | undefined) => {
                resolve(res);
                return;
            });
        });
    }

    public static ShowErrorMessage(message: string, ...urlMessageItem: IButtonMessageItem[]): Q.Promise<IButtonMessageItem | undefined> {
        return Q.Promise<IButtonMessageItem | undefined>((resolve, reject) => {
            return this.showMessage(message, MessageTypes.Error, ...urlMessageItem).then((res: IButtonMessageItem | undefined) => {
                resolve(res);
                return;
            });
        });
    }

    public static appCenterExtensionIsInstalled() {
        const appcenterExt = extensions.getExtension(ACConstants.AppCenterExtId);
        return appcenterExt ? true : false;
    }

    private static async showMessage(messageToDisplay: string, type: MessageTypes, ...urlMessageItem: IButtonMessageItem[]): Promise<IButtonMessageItem | undefined> {
        // The following "cast" allows us to pass our own type around (and not reference "vscode" via an import)
        const messageItems: ButtonMessageItem[] = <ButtonMessageItem[]>urlMessageItem;

        let chosenItem: IButtonMessageItem | undefined;
        switch (type) {
            case MessageTypes.Error:
                chosenItem = await window.showErrorMessage(messageToDisplay, ...messageItems);
                break;
            case MessageTypes.Info:
                chosenItem = await window.showInformationMessage(messageToDisplay, ...messageItems);
                break;
            case MessageTypes.Warn:
                chosenItem = await window.showWarningMessage(messageToDisplay, ...messageItems);
                break;
            default:
                break;
        }

        if (chosenItem) {
            if (chosenItem.url) {
                ACUtils.OpenUrl(chosenItem.url);
            }
            if (chosenItem.command) {
                commands.executeCommand<void>(chosenItem.command);
            }
        }

        return chosenItem;
    }
}