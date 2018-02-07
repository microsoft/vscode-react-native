// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.

import * as vscode from "vscode";
import * as Q from "q";
import * as qs from "qs";
import * as os from "os";

import { ILogger, LogLevel } from "../../log/LogHelper";
import Auth from "../../appcenter/auth/auth";
import { AppCenterLoginType, ACConstants, AppCenterOS, CurrentAppDeployment } from "../appCenterConstants";
import { Profile, getUser } from "../../appcenter/auth/profile/profile";
import { SettingsHelper } from "../../settingsHelper";
import { AppCenterClient, models } from "../api/index";
import { DefaultApp, ICodePushReleaseParams } from "./commandParams";
import { AppCenterExtensionManager } from "../appCenterExtensionManager";
import { ACStrings } from "../appCenterStrings";
import CodePushReleaseReact from "../codepush/releaseReact";
import { ACUtils } from "../appCenterUtils";
import { getQPromisifiedClientResult } from "../api/createClient";

interface IAppCenterAuth {
    login(appcenterManager: AppCenterExtensionManager): Q.Promise<void>;
    logout(appcenterManager: AppCenterExtensionManager): Q.Promise<void>;
    whoAmI(profile: Profile): Q.Promise<void>;
}

interface IAppCenterApps {
    getCurrentApp(): Q.Promise<void>;
    setCurrentApp(client: AppCenterClient, appCenterManager: AppCenterExtensionManager): Q.Promise<void>;

    setCurrentDeployment(appCenterManager: AppCenterExtensionManager): Q.Promise<void>;
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

    public whoAmI(profile: Profile): Q.Promise<void> {
        if (profile && profile.displayName) {
            vscode.window.showInformationMessage(ACStrings.YouAreLoggedInMsg(profile.displayName));
        } else {
            vscode.window.showInformationMessage(ACStrings.UserIsNotLoggedInMsg);
        }
        return Q.resolve(void 0);
    }

    public setCurrentDeployment(appCenterManager: AppCenterExtensionManager): Q.Promise<void> {
        this.restoreCurrentApp().then((currentApp: DefaultApp) => {
            if (currentApp && currentApp.currentAppDeployment && currentApp.currentAppDeployment.codePushDeployments) {
                const deploymentOptions: string[] = currentApp.currentAppDeployment.codePushDeployments.map((deployment) => {
                    return deployment.name;
                });
                vscode.window.showQuickPick(deploymentOptions, { placeHolder: ACStrings.SelectCurrentDeploymentMsg })
                .then((deploymentName) => {
                    if (deploymentName) {
                        this.saveCurrentApp(currentApp.identifier, AppCenterOS[currentApp.os], {
                            currentDeploymentName: deploymentName,
                            codePushDeployments: currentApp.currentAppDeployment.codePushDeployments,
                        }).then((app: DefaultApp | null) => {
                            if (app) {
                                appCenterManager.setCurrentDeploymentStatusBar(deploymentName);
                            }
                        });
                    }
                });
            } else {
                appCenterManager.setCurrentDeploymentStatusBar(null);
            }
        });
        return Q.resolve(void 0);
    }

    public getCurrentApp(): Q.Promise<void> {
        this.restoreCurrentApp().then((app: DefaultApp) => {
            if (app) {
                vscode.window.showInformationMessage(ACStrings.YourCurrentAppMsg(app.identifier));
            } else {
                vscode.window.showInformationMessage(ACStrings.NoCurrentAppSetMsg);
            }
        });
        return Q.resolve(void 0);
    }

    public setCurrentApp(client: AppCenterClient, appCenterManager: AppCenterExtensionManager): Q.Promise<void> {
        return getQPromisifiedClientResult(client.account.apps.list()).then((apps: models.AppResponse[]) => {
            const appsList: models.AppResponse[] = apps;
            const reactNativeApps = appsList.filter(app => app.platform === ACConstants.AppCenterReactNativePlatformName);
            let options = reactNativeApps.map(app => {
                return {
                    label: `${app.name} (${app.os})`,
                    description: app.displayName,
                    target: app.name,
                };
            });
            vscode.window.showQuickPick(options, { placeHolder: ACStrings.ProvideCurrentAppPromptMsg })
            .then((selected: {label: string, description: string, target: string}) => {
                if (selected) {
                    const selectedApps: models.AppResponse[] = appsList.filter(app => app.name === selected.target);
                    if (selectedApps && selectedApps.length === 1) {
                        const selectedApp: models.AppResponse = selectedApps[0];
                        const selectedAppName: string = `${selectedApp.owner.name}/${selectedApp.name}`;
                        const OS: AppCenterOS = AppCenterOS[selectedApp.os];
                        getQPromisifiedClientResult(client.codepush.codePushDeployments.list(selectedApp.name, selectedApp.owner.name)).then((deployments: models.Deployment[]) => {
                            let currentDeployment: CurrentAppDeployment | null = null;
                            if (deployments.length > 0) {
                                currentDeployment = {
                                    codePushDeployments: deployments,
                                    currentDeploymentName: deployments[0].name, // Select 1st one by default
                                };
                            }
                            this.saveCurrentApp(selectedAppName, OS, currentDeployment).then((app: DefaultApp | null) => {
                                if (app) {
                                    vscode.window.showInformationMessage(ACStrings.YourCurrentAppMsg(selected.target));
                                    appCenterManager.setCurrentAppStatusBar(ACUtils.formatAppNameForStatusBar(app));
                                }
                            });
                        });
                    }
                }
                return Q.resolve(void 0);
            });
            return Q.resolve(void 0);
        });
    }

    public releaseReact(client: AppCenterClient, appCenterManager: AppCenterExtensionManager): Q.Promise<void> {
        const targetBinaryVersion = "1.0.0";
        const deploymentName = "Staging";
        const bundleZipPath = appCenterManager.projectRootPath; // TODO: create a bundle based on project root path

        return this.restoreCurrentApp().then((currentApp: DefaultApp) => {
            if (!currentApp) {
                vscode.window.showWarningMessage(ACStrings.NoCurrentAppSetMsg);
                return;
            }
            let codePushRelaseParams: ICodePushReleaseParams = {
                app: currentApp,
                appVersion: targetBinaryVersion,
                deploymentName: deploymentName,
                updatedContentZipPath: bundleZipPath,
            };
            CodePushReleaseReact.exec(client, codePushRelaseParams, this.logger);
        });
    }

    private saveCurrentApp(currentAppName: string, appOS: AppCenterOS, currentAppDeployment: CurrentAppDeployment | null): Q.Promise<DefaultApp | null> {
        const defaultApp = ACUtils.toDefaultApp(currentAppName, appOS, currentAppDeployment);
        if (!defaultApp) {
            vscode.window.showWarningMessage(ACStrings.InvalidCurrentAppNameMsg);
            return Q.resolve(null);
        }

        let profile = getUser();
        if (profile) {
            profile.defaultApp = defaultApp;
            profile.save();
            return Q.resolve(defaultApp);
        } else {
            // No profile - not logged in?
            vscode.window.showWarningMessage(ACStrings.UserIsNotLoggedInMsg);
            return Q.resolve(null);
        }
    }

    private restoreCurrentApp(): Q.Promise<DefaultApp | null> {
        const user = getUser();
        if (user) {
            if (user.defaultApp) {
                const currentApp = `${user.defaultApp.ownerName}/${user.defaultApp.appName}`;
                const defaultApp: DefaultApp | null = ACUtils.toDefaultApp(currentApp, AppCenterOS[user.defaultApp.os], user.defaultApp.currentAppDeployment);
                if (defaultApp) {
                    return Q.resolve(defaultApp);
                }
            }
        }
        return Q.resolve(null);
    }

    private loginWithToken(token: string | undefined, appCenterManager: AppCenterExtensionManager) {
        if (!token) {
            return;
        }
        return Auth.doTokenLogin(token).then((profile: Profile) => {
            if (!profile) {
                this.logger.log("Failed to fetch user info from server", LogLevel.Error);
                vscode.window.showWarningMessage(ACStrings.FailedToExecuteLoginMsg);
                return;
            }
            vscode.window.showInformationMessage(ACStrings.YouAreLoggedInMsg(profile.displayName));
            appCenterManager.setupAuthenticatedStatusBar(profile.displayName);
            this.restoreCurrentApp().then((currentApp: DefaultApp) => {
                appCenterManager.setupAppCenterStatusBarsWithCurrentApp(currentApp);
            });
        });
    }
}