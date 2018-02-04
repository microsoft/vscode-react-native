// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.

import * as vscode from "vscode";
import * as Q from "q";
import * as qs from "qs";
import * as os from "os";

import { ILogger, LogLevel } from "../../log/LogHelper";
// tslint:disable-next-line:no-var-requires
const opener = require("opener");
import Auth from "../../appcenter/auth/auth";
import { AppCenterLoginType } from "../appCenterConstants";
import { Profile } from "../../appcenter/auth/profile/profile";
import { SettingsHelper } from "../../settingsHelper";
import { AppCenterClient } from "../api/index";
import { DefaultApp } from "./commandParams";
import { AppCenterExtensionManager } from "../appCenterExtensionManager";
import { ACStrings } from "../appCenterStrings";

interface IAppCenterAuth {
    login(appcenterManager: AppCenterExtensionManager): Q.Promise<void>;
    logout(appcenterManager: AppCenterExtensionManager): Q.Promise<void>;
    whoAmI(): Q.Promise<void>;
}

interface IAppCenterApps {
    getCurrentApp(): Q.Promise<void>;
    setCurrentApp(): Q.Promise<void>;
}

interface IAppCenterCodePush {
    releaseReact(client: AppCenterClient, appCenterManager: AppCenterExtensionManager): Q.Promise<void>;
}

export class AppCenterCommandExecutor implements IAppCenterAuth, IAppCenterCodePush, IAppCenterApps {
    private logger: ILogger;

    constructor(logger: ILogger) {
        this.logger = logger;
    }

    public login(appCenterManager: AppCenterExtensionManager): Q.Promise<void> {
        const appCenterLoginOptions: string[] = Object.keys(AppCenterLoginType).filter(k => typeof AppCenterLoginType[k as any] === "number");
        vscode.window.showQuickPick(appCenterLoginOptions, { placeHolder: ACStrings.SelectLoginTypeMsg })
            .then((loginType) => {
                switch (loginType) {
                    case (AppCenterLoginType[AppCenterLoginType.Interactive]):
                        const loginUrl = `${SettingsHelper.getAppCenterLoginEndpoint()}?${qs.stringify({ hostname: os.hostname()})}`;
                        vscode.window.showInformationMessage(ACStrings.PleaseLoginViaBrowser, "OK")
                        .then((selection: string) => {
                            if (selection.toLowerCase() === "ok") {
                                opener(loginUrl);
                                return vscode.window.showInputBox({ prompt: ACStrings.PleaseProvideToken, ignoreFocusOut: true }).then(token => {
                                    if (token) {
                                        this.loginWithToken(token, appCenterManager);
                                    }
                                });
                            } else return Q.resolve(void 0);
                        });
                        break;
                    case (AppCenterLoginType[AppCenterLoginType.Token]):
                        vscode.window.showInputBox({ prompt: ACStrings.PleaseProvideToken , ignoreFocusOut: true}).then(token => {
                            if (token) {
                                this.loginWithToken(token, appCenterManager);
                            }
                        });
                        break;
                    default:
                        throw new Error("Unsupported login parameter!");
                }
        });
        return Q.resolve(void 0);
    }

    public logout(appCenterManager: AppCenterExtensionManager): Q.Promise<void> {
        const logoutChoices: string[] = ["Logout"];
        vscode.window.showQuickPick(logoutChoices, { placeHolder: ACStrings.LogoutPrompt })
            .then((logoutType) => {
                switch (logoutType) {
                    case ("Logout"):
                        return Auth.doLogout().then(() => {
                            vscode.window.showInformationMessage(ACStrings.UserLoggedOutMsg);
                            appCenterManager.setupNotAuthenticatedStatusBar();
                            return Q.resolve(void 0);
                        }).catch(() => {
                            this.logger.log("An errro occured on logout", LogLevel.Error);
                        });
                    default:
                        return Q.resolve(void 0);
                    }
                });
        return Q.resolve(void 0);
    }

    public whoAmI(): Q.Promise<void> {
        return Auth.whoAmI().then((displayName: string) => {
            if (displayName) {
                vscode.window.showInformationMessage(ACStrings.YouAreLoggedInMsg(displayName));
            } else {
                vscode.window.showInformationMessage(ACStrings.UserIsNotLoggedInMsg);
            }
        });
    }

    public getCurrentApp(): Q.Promise<void> {
        this.getCurrentAppForUser().then((app: DefaultApp) => {
            vscode.window.showInformationMessage(ACStrings.YourCurrentAppMsg(app.identifier));
        });
        return Q.resolve(void 0);
    }

    public setCurrentApp(): Q.Promise<void> {
        vscode.window.showInformationMessage(`Current App was saved!`);
        return Q.resolve(void 0);
    }

    public releaseReact(client: AppCenterClient, appCenterManager: AppCenterExtensionManager): Q.Promise<void> {
        return Q.resolve(void 0);
    }

    private getCurrentAppForUser(): Q.Promise<DefaultApp> {
        // TODO: get it for real!
        let app: DefaultApp = {
            appName: "UpdatedViaCLI",
            ownerName: "max-mironov",
            identifier: "max-mironov/UpdatedViaClI",
        };
        return Q.resolve(app);
    }

    private loginWithToken(token: string, appCenterManager: AppCenterExtensionManager) {
        return Auth.doTokenLogin(token).then((profile: Profile) => {
            vscode.window.showInformationMessage(ACStrings.YouAreLoggedInMsg(profile.displayName));
            appCenterManager.setuAuthenticatedStatusBar(profile.displayName);
            return this.getCurrentAppForUser().then((currentApp: DefaultApp) => {
                appCenterManager.setCurrentAppStatusBar(currentApp.identifier);
            });
        });
    }
}