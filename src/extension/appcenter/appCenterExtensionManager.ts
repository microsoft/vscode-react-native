// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.

import { Disposable, StatusBarAlignment, StatusBarItem, window } from "vscode";
import Auth from "../appcenter/auth/auth";
import { ACStrings } from "./appCenterStrings";
import * as Q from "q";
import { ACCommandNames, ACConstants } from "./appCenterConstants";
import { DefaultApp } from "./command/commandParams";

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
                return this.setuAuthenticatedStatusBar();
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
        this.setStatusBar(this.loginStatusBarItem, `Login to App Center`, ACStrings.UserMustSignIn, `${ACConstants.ExtensionPrefixName}.${ACCommandNames.Login}`);
        if (this.currentAppStatusBarItem) {
            this.currentAppStatusBarItem.hide();
        }
    }

    public setuAuthenticatedStatusBar() {
        return Auth.whoAmI().then((userName: string) => {
            this.setStatusBar(this.loginStatusBarItem, userName, userName, `${ACConstants.ExtensionPrefixName}.${ACCommandNames.Logout}`);
            return this.getCurrentApp().then((currentApp: DefaultApp) => {
                return this.setStatusBar(this.currentAppStatusBarItem, currentApp.identifier, currentApp.identifier, `${ACConstants.ExtensionPrefixName}.${ACCommandNames.SetCurrentApp}`);
            });
        });
    }

    private getCurrentApp(): Q.Promise<DefaultApp> {
        // TODO: get from e.g. setting so on
        let app = {
            ownerName: "max-mironov",
            appName: "test",
            identifier: "max-mironov/test",
        };
        return Q.resolve(app);
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