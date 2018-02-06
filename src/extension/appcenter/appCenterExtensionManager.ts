// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.

import { Disposable, StatusBarAlignment, StatusBarItem, window } from "vscode";
import Auth from "../appcenter/auth/auth";
import { ACStrings } from "./appCenterStrings";
import * as Q from "q";
import { ACCommandNames, ACConstants } from "./appCenterConstants";
import { Profile } from "./auth/profile/profile";
import { ACUtils } from "./appCenterUtils";

export class AppCenterExtensionManager implements Disposable {
    private loginStatusBarItem: StatusBarItem;
    private currentAppStatusBarItem: StatusBarItem;
    private currentDeploymentStatusBarItem: StatusBarItem;
    private _projectRootPath: string;

    public constructor(projectRootPath: string) {
        this._projectRootPath = projectRootPath;
    }

    public get projectRootPath(): string {
        return this._projectRootPath;
    }

    public setup(): Q.Promise<void>  {
        this.loginStatusBarItem = window.createStatusBarItem(StatusBarAlignment.Left, 12);
        this.currentAppStatusBarItem = window.createStatusBarItem(StatusBarAlignment.Left, 11);
        this.currentDeploymentStatusBarItem = window.createStatusBarItem(StatusBarAlignment.Left, 10);

        return Auth.whoAmI().then((profile: Profile) => {
            if (!profile) {
                return this.setupNotAuthenticatedStatusBar();
            } else {
                if (profile && profile.defaultApp) {
                    this.setCurrentAppStatusBar(ACUtils.formatAppNameForStatusBar(profile.defaultApp));
                    this.setCurrentDeploymentStatusBar(profile.defaultApp.currentAppDeployment.currentDeploymentName);
                } else {
                    this.setCurrentAppStatusBar(null);
                    this.setCurrentDeploymentStatusBar(null);
                }
                return this.setuAuthenticatedStatusBar(profile.userName);
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
        if (this.currentDeploymentStatusBarItem) {
            this.currentDeploymentStatusBarItem.hide();
        }
    }

    public setuAuthenticatedStatusBar(userName: string) {
        this.setStatusBar(this.loginStatusBarItem,
            `$(icon octicon-person) ${userName}`,
            ACStrings.YouAreLoggedInMsg(userName),
            `${ACConstants.ExtensionPrefixName}.${ACCommandNames.Logout}`
        );
    }

    public setCurrentDeploymentStatusBar(deploymentName: string | null) {
        if (deploymentName) {
            return this.setStatusBar(this.currentDeploymentStatusBarItem,
                `$(icon octicon-repo-forked) ${deploymentName}`,
                ACStrings.YourCurrentDeploymentMsg(deploymentName),
                `${ACConstants.ExtensionPrefixName}.${ACCommandNames.SetCurrentDeployment}`);
        } else {
            return this.setStatusBar(this.currentDeploymentStatusBarItem,
                `$(icon octicon-alert) ${ACStrings.NoCurrentDeploymentSetMsg}`,
                ACStrings.PleaseProvideCurrentDeploymentMsg,
                `${ACConstants.ExtensionPrefixName}.${ACCommandNames.SetCurrentDeployment}`);
        }
    }

    public setCurrentAppStatusBar(appName: string | null) {
        if (appName) {
            return this.setStatusBar(this.currentAppStatusBarItem,
                `$(icon octicon-browser) ${appName}`,
                ACStrings.YourCurrentAppMsg(appName),
                `${ACConstants.ExtensionPrefixName}.${ACCommandNames.SetCurrentApp}`);
        } else {
            return this.setStatusBar(this.currentAppStatusBarItem,
                `$(icon octicon-alert) ${ACStrings.NoCurrentAppSetMsg}`,
                ACStrings.PleaseProvideCurrentAppMsg,
                `${ACConstants.ExtensionPrefixName}.${ACCommandNames.SetCurrentApp}`);
        }
    }

    private setStatusBar(statusBar: StatusBarItem, text: string, tooltip: string, commandOnClick?: string): void {
        if (statusBar !== undefined) {
            statusBar.command = commandOnClick; // undefined clears the command
            statusBar.text = text;
            statusBar.tooltip = tooltip;
            statusBar.show();
            statusBar.color = ACConstants.AppCenterCodePushStatusBarColor;
        }
    }
}