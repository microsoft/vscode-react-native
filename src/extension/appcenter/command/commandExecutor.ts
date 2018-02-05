// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.

import * as vscode from "vscode";
import * as Q from "q";
import * as qs from "qs";
import * as os from "os";

import { ILogger, LogLevel } from "../../log/LogHelper";
import Auth from "../../appcenter/auth/auth";
import { AppCenterLoginType } from "../appCenterConstants";
import { Profile, getUser } from "../../appcenter/auth/profile/profile";
import { SettingsHelper } from "../../settingsHelper";
import { AppCenterClient } from "../api/index";
import { DefaultApp, ICodePushReleaseParams } from "./commandParams";
import { AppCenterExtensionManager } from "../appCenterExtensionManager";
import { ACStrings } from "../appCenterStrings";
import CodePushReleaseReact from "../codepush/releaseReact";
import { ACUtils } from "../appCenterUtils";
import { updateContents, reactNative } from "codepush-node-sdk";
import BundleInfo = reactNative.BundleInfo;

interface IAppCenterAuth {
    login(appcenterManager: AppCenterExtensionManager): Q.Promise<void>;
    logout(appcenterManager: AppCenterExtensionManager): Q.Promise<void>;
    whoAmI(): Q.Promise<void>;
}

interface IAppCenterApps {
    getCurrentApp(): Q.Promise<void>;
    setCurrentApp(appCenterManager: AppCenterExtensionManager): Q.Promise<void>;
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
                        vscode.window.showInformationMessage(ACStrings.PleaseLoginViaBrowser, "OK")
                        .then((selection: string) => {
                            if (selection.toLowerCase() === "ok") {
                                const loginUrl = `${SettingsHelper.getAppCenterLoginEndpoint()}?${qs.stringify({ hostname: os.hostname()})}`;
                                ACUtils.OpenUrl(loginUrl);
                                return vscode.window.showInputBox({ prompt: ACStrings.PleaseProvideToken, ignoreFocusOut: true })
                                .then(token => {
                                    this.loginWithToken(token, appCenterManager);
                                });
                            } else return Q.resolve(void 0);
                        });
                        break;
                    case (AppCenterLoginType[AppCenterLoginType.Token]):
                        vscode.window.showInputBox({ prompt: ACStrings.PleaseProvideToken , ignoreFocusOut: true})
                        .then(token => {
                            this.loginWithToken(token, appCenterManager);
                        });
                        break;
                    default:
                        throw new Error("Unsupported login parameter!");
                }
        });
        return Q.resolve(void 0);
    }

    public logout(appCenterManager: AppCenterExtensionManager): Q.Promise<void> {
        const logoutOption = "Logout";
        const logoutChoices: string[] = [logoutOption];
        vscode.window.showQuickPick(logoutChoices, { placeHolder: ACStrings.LogoutPrompt })
        .then((logoutType) => {
            switch (logoutType) {
                case (logoutOption):
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
        return Auth.whoAmI().then((profile: Profile) => {
            if (profile.displayName) {
                vscode.window.showInformationMessage(ACStrings.YouAreLoggedInMsg(profile.displayName));
                return;
            }
        }).catch(() => {
            vscode.window.showInformationMessage(ACStrings.UserIsNotLoggedInMsg);
            return;
        });
    }

    public getCurrentApp(): Q.Promise<void> {
        this.restoreCurrentApp().then((app: DefaultApp) => {
            vscode.window.showInformationMessage(ACStrings.YourCurrentAppMsg(app.identifier));
        }).catch(e => {
            vscode.window.showInformationMessage(ACStrings.NoCurrentAppSetMsg);
        });
        return Q.resolve(void 0);
    }

    public setCurrentApp(appCenterManager: AppCenterExtensionManager): Q.Promise<void> {
        vscode.window.showInputBox({ prompt: ACStrings.ProvideCurrentAppPromptMsg, ignoreFocusOut: true })
        .then((currentApp: string) => {
            // TODO: I believe we should validate app here for existance! before we save anything
            this.saveCurrentApp(<string>currentApp).then((saved: boolean) => {
                if (saved) {
                    vscode.window.showInformationMessage(ACStrings.YourCurrentAppMsg(currentApp));
                    appCenterManager.setCurrentAppStatusBar(currentApp);
                }
            });
        });
        return Q.resolve(void 0);
    }

    public releaseReact(client: AppCenterClient, appCenterManager: AppCenterExtensionManager): Q.Promise<void> {
        let codePushRelaseParams: ICodePushReleaseParams;

        return Q.Promise<void>((resolve, reject) => {
            reactNative.getAndroidAppVersion()
                .then((appVersion: string) => {
                    codePushRelaseParams.appVersion = appVersion;
                    return reactNative.makeUpdateContents(<BundleInfo>{ os: "android" });
                }).then((pathToUpdateContents: string) => {
                    return updateContents.zip(pathToUpdateContents);
                }).then((pathToZippedBundle: string) => {
                    codePushRelaseParams.updatedContentZipPath = pathToZippedBundle;
                    return new Promise<DefaultApp>((appResolve, appReject) => {
                        this.restoreCurrentApp()
                            .then(currentApp => appResolve(<DefaultApp>currentApp))
                            .catch(err => appReject(err));
                    });
                }).then((currentApp: DefaultApp) => {
                    if (!currentApp) {
                        vscode.window.showInformationMessage(ACStrings.NoCurrentAppSetMsg);
                        return;
                    }
                    codePushRelaseParams.app = currentApp;
                    codePushRelaseParams.deploymentName = "Staging";
                    CodePushReleaseReact.exec(client, codePushRelaseParams, this.logger);
                }).then(value => resolve(value))
                .catch(error => reject(error));
        });

    }

    private saveCurrentApp(currentApp: string): Q.Promise<boolean> {
        const defaultApp = ACUtils.toDefaultApp(currentApp);
        if (!defaultApp) {
            vscode.window.showInformationMessage(ACStrings.InvalidCurrentAppNameMsg);
            return Q<boolean>(false);
        }
        let profile = getUser();
        if (profile) {
            profile.defaultApp = defaultApp;
            profile.save();
            return Q<boolean>(true);
        } else {
            // No profile - not logged in?
            vscode.window.showInformationMessage(ACStrings.UserIsNotLoggedInMsg);
            return Q<boolean>(false);
        }
    }

    private restoreCurrentApp(): Q.Promise<DefaultApp | null> {
        const user = getUser();
        if (user) {
            const currentApp = user.defaultApp
                ? `${user.defaultApp.ownerName}/${user.defaultApp.appName}`
                : "";
            const defaultApp: DefaultApp | null = ACUtils.toDefaultApp(currentApp);
            if (defaultApp) {
                return Q.resolve(defaultApp);
            }
        }
        return Q.resolve(null);
    }

    private loginWithToken(token: string | undefined, appCenterManager: AppCenterExtensionManager) {
        if (!token) {
            return;
        }
        return Auth.doTokenLogin(token).then((profile: Profile) => {
            vscode.window.showInformationMessage(ACStrings.YouAreLoggedInMsg(profile.displayName));
            appCenterManager.setuAuthenticatedStatusBar(profile.displayName);
            this.restoreCurrentApp().then((currentApp: DefaultApp) => {
                if (currentApp) {
                    appCenterManager.setCurrentAppStatusBar(currentApp.identifier);
                } else {
                    appCenterManager.setCurrentAppStatusBar(null);
                }
            });
        });
    }
}