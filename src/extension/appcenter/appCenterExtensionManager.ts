// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.

import { Disposable, StatusBarAlignment, StatusBarItem, window } from "vscode";
import Auth from "../appcenter/auth/auth";
import { ACStrings } from "./appCenterStrings";
import * as Q from "q";
import { ACCommandNames, ACConstants } from "./appCenterConstants";

export class AppCenterExtensionManager implements Disposable {
    private loginStatusBarItem: StatusBarItem;
    private currentAppStatusBarItem: StatusBarItem;

    public setup(): Q.Promise<void>  {
        this.loginStatusBarItem = window.createStatusBarItem(StatusBarAlignment.Left, 100);
        this.currentAppStatusBarItem = window.createStatusBarItem(StatusBarAlignment.Left, 99);

        return Auth.isAuthenticated().then((isAuthenticated: boolean) => {
            if (!isAuthenticated) {
                return this.setupNotAuthenticatedStatusBar();
            } else {
                return Auth.whoAmI().then(userName => {
                    return this.setuAuthenticatedStatusBar(userName);
                });
            }
        });
    }

    public dispose() {
        if (this.loginStatusBarItem) {
            this.loginStatusBarItem.dispose();
        }
        if (this.currentAppStatusBarItem) {
            this.currentAppStatusBarItem.dispose();
        }
    }

    public setupNotAuthenticatedStatusBar() {
        this.setStatusBar(this.loginStatusBarItem,
            `$(icon octicon-person) Login to App Center`,
            ACStrings.UserMustSignIn,
            `${ACConstants.ExtensionPrefixName}.${ACCommandNames.Login}`
        );
        if (this.currentAppStatusBarItem) {
            this.currentAppStatusBarItem.hide();
        }
    }

    public setuAuthenticatedStatusBar(userName: string) {
        this.setStatusBar(this.loginStatusBarItem,
            `$(icon octicon-person) ${userName}`,
            ACStrings.YouAreLoggedInMsg(userName),
            `${ACConstants.ExtensionPrefixName}.${ACCommandNames.Logout}`
        );
    }

    public setCurrentAppStatusBar(appName: string) {
        return this.setStatusBar(this.currentAppStatusBarItem,
            appName,
            ACStrings.YourCurrentAppMsg(appName),
            `${ACConstants.ExtensionPrefixName}.${ACCommandNames.SetCurrentApp}`);
    }

    private setStatusBar(statusBar: StatusBarItem, text: string, tooltip: string, commandOnClick?: string): void {
        if (statusBar !== undefined) {
            statusBar.command = commandOnClick; // undefined clears the command
            statusBar.text = text;
            statusBar.tooltip = tooltip;
            statusBar.show();
        }
    }
}