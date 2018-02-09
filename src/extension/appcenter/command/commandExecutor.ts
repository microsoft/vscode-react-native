// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.

import * as vscode from "vscode";
import * as Q from "q";
import * as qs from "qs";
import * as os from "os";

import { ILogger, LogLevel } from "../../log/LogHelper";
import Auth from "../../appcenter/auth/auth";
import { AppCenterLoginType, ACConstants, AppCenterOS, CurrentAppDeployments, ACCommandNames } from "../appCenterConstants";
import { Profile } from "../../appcenter/auth/profile/profile";
import { SettingsHelper } from "../../settingsHelper";
import { AppCenterClient, models } from "../api/index";
import { DefaultApp, ICodePushReleaseParams } from "./commandParams";
import { AppCenterExtensionManager } from "../appCenterExtensionManager";
import { ACStrings } from "../appCenterStrings";
import CodePushReleaseReact from "../codepush/releaseReact";
import { ACUtils } from "../appCenterUtils";
import { updateContents, reactNative, fileUtils } from "codepush-node-sdk";
import BundleConfig = reactNative.BundleConfig;
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
    showMenu(client: AppCenterClient, appCenterManager: AppCenterExtensionManager): Q.Promise<void>;
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
                    return vscode.window.showInformationMessage(ACStrings.PleaseLoginViaBrowser, "OK")
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
                case (AppCenterLoginType[AppCenterLoginType.Token]):
                    return vscode.window.showInputBox({ prompt: ACStrings.PleaseProvideToken , ignoreFocusOut: true})
                    .then(token => {
                        return this.loginWithToken(token, appCenterManager);
                    });
                default:
                    // User canel login otherwise
                    return Q.resolve(void 0);
            }
        });
        return Q.resolve(void 0);
    }

    public logout(appCenterManager: AppCenterExtensionManager): Q.Promise<void> {
        return Auth.doLogout().then(() => {
            vscode.window.showInformationMessage(ACStrings.UserLoggedOutMsg);
            return appCenterManager.setupAppCenterStatusBar(null);
        }).catch(() => {
            this.logger.log("An errro occured on logout", LogLevel.Error);
        });
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
        this.restoreCurrentApp()
        .then((currentApp: DefaultApp) => {
            if (currentApp && currentApp.currentAppDeployments && currentApp.currentAppDeployments.codePushDeployments) {
                const deploymentOptions: string[] = currentApp.currentAppDeployments.codePushDeployments.map((deployment) => {
                    return deployment.name;
                });
                vscode.window.showQuickPick(deploymentOptions, { placeHolder: ACStrings.SelectCurrentDeploymentMsg })
                .then((deploymentName) => {
                    if (deploymentName) {
                        this.saveCurrentApp(currentApp.identifier, AppCenterOS[currentApp.os], {
                            currentDeploymentName: deploymentName,
                            codePushDeployments: currentApp.currentAppDeployments.codePushDeployments,
                        });
                    }
                });
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
        vscode.window.withProgress({ location: vscode.ProgressLocation.Window, title: "Get Apps"}, p => {
            return new Promise((resolve, reject) => {
                p.report({message: ACStrings.FetchAppsStatusBarMessage });
                getQPromisifiedClientResult(client.account.apps.list()).then((apps: models.AppResponse[]) => {
                    const appsList: models.AppResponse[] = apps;
                    const reactNativeApps = appsList.filter(app => app.platform === ACConstants.AppCenterReactNativePlatformName);
                    resolve(reactNativeApps);
                });
            });
        }).then((rnApps: models.AppResponse[]) => {
            let options = rnApps.map(app => {
                return {
                    label: `${app.name} (${app.os})`,
                    description: app.displayName,
                    target: app.name,
                };
            });
            vscode.window.showQuickPick(options, { placeHolder: ACStrings.ProvideCurrentAppPromptMsg })
            .then((selected: {label: string, description: string, target: string}) => {
                if (selected) {
                    const selectedApps: models.AppResponse[] = rnApps.filter(app => app.name === selected.target);
                    if (selectedApps && selectedApps.length === 1) {
                        const selectedApp: models.AppResponse = selectedApps[0];
                        const selectedAppName: string = `${selectedApp.owner.name}/${selectedApp.name}`;
                        const OS: AppCenterOS = AppCenterOS[selectedApp.os];

                        vscode.window.withProgress({ location: vscode.ProgressLocation.Window, title: "Get Deployments"}, p => {
                            return new Promise((resolve, reject) => {
                                p.report({message: ACStrings.FetchDeploymentsStatusBarMessage });
                                getQPromisifiedClientResult(client.codepush.codePushDeployments.list(selectedApp.name, selectedApp.owner.name))
                                .then((deployments: models.Deployment[]) => {
                                    resolve(deployments.sort((a, b): any => {
                                        return a.name < b.name; // sort alphabetically
                                    }));
                                });
                            });
                        })
                        .then((appDeployments: models.Deployment[]) => {
                            let currentDeployments: CurrentAppDeployments | null = null;
                            if (appDeployments.length > 0) {
                                currentDeployments = {
                                    codePushDeployments: appDeployments,
                                    currentDeploymentName: appDeployments[0].name, // Select 1st one by default
                                };
                            }
                            this.saveCurrentApp(selectedAppName, OS, currentDeployments)
                            .then((app: DefaultApp | null) => {
                                if (app) {
                                    return vscode.window.showInformationMessage(ACStrings.YourCurrentAppAndDeployemntMsg(selected.target
                                        , app.currentAppDeployments.currentDeploymentName));
                                } else {
                                    this.logger.error("Failed to save current app");
                                    return Q.resolve(void 0);
                                }
                            });
                        });
                    }
                }
            });
        });
        return Q.resolve(void 0);
    }

    public releaseReact(client: AppCenterClient, appCenterManager: AppCenterExtensionManager): Q.Promise<void> {
        let codePushRelaseParams = <ICodePushReleaseParams>{};
        const projectRootPath: string = appCenterManager.projectRootPath;
        let updateContentsDirectory: string;
        return Q.Promise<any>((resolve, reject) => {
            vscode.window.withProgress({ location: vscode.ProgressLocation.Window, title: "Get Apps" }, p => {
                return new Promise<DefaultApp>((appResolve, appReject) => {
                    p.report({ message: ACStrings.GettingAppInfoMessage });
                    this.restoreCurrentApp()
                        .then((currentApp: DefaultApp) => appResolve(<DefaultApp>currentApp))
                        .catch(err => appReject(err));
                }).then((currentApp: DefaultApp): any => {
                    p.report({ message: ACStrings.DetectingAppVersionMessage });
                    if (!currentApp) {
                        throw new Error(`No current app has been specified.`);
                    }
                    if (!reactNative.isValidOS(currentApp.os)) {
                        throw new Error(`OS must be "android", "ios", or "windows".`);
                    }
                    codePushRelaseParams.app = currentApp;
                    codePushRelaseParams.deploymentName = currentApp.currentAppDeployments.currentDeploymentName;
                    currentApp.os = currentApp.os.toLowerCase();
                    switch (currentApp.os) {
                        case "android": return reactNative.getAndroidAppVersion(projectRootPath);
                        case "ios": return reactNative.getiOSAppVersion(projectRootPath);
                        case "windows": return reactNative.getWindowsAppVersion(projectRootPath);
                        default: throw new Error(`OS must be "android", "ios", or "windows".`);
                    }
                }).then((appVersion: string) => {
                    p.report({ message: ACStrings.RunningReactNativeBundleCommandMessage });
                    codePushRelaseParams.appVersion = appVersion;
                    return reactNative.makeUpdateContents(<BundleConfig>{
                        os: codePushRelaseParams.app.os,
                        projectRootPath: projectRootPath,
                    });
                }).then((pathToUpdateContents: string) => {
                    p.report({ message: ACStrings.ArchivingUpdateContentsMessage });
                    updateContentsDirectory = pathToUpdateContents;
                    return updateContents.zip(pathToUpdateContents, projectRootPath);
                }).then((pathToZippedBundle: string) => {
                    p.report({ message: ACStrings.ReleasingUpdateContentsMessage });
                    codePushRelaseParams.updatedContentZipPath = pathToZippedBundle;
                    return new Promise<any>((publishResolve, publishReject) => {
                        CodePushReleaseReact.exec(client, codePushRelaseParams, this.logger)
                            .then((response: any) => publishResolve(response))
                            .catch((error: any) => publishReject(error));
                    });
                }).then((response: any) => {
                    if (response.succeeded && response.result) {
                        vscode.window.showInformationMessage(`Successfully released an update containing the "${updateContentsDirectory}" ` +
                            `directory to the "${codePushRelaseParams.deploymentName}" deployment of the "${codePushRelaseParams.app.appName}" app`);
                        resolve(response.result);
                    } else {
                        vscode.window.showErrorMessage(response.errorMessage);
                    }
                    fileUtils.rmDir(codePushRelaseParams.updatedContentZipPath);
                }).catch((error: Error) => {
                    if (error && error.message) {
                        vscode.window.showErrorMessage(`An error occured on doing Code Push release. ${error.message}`);
                    } else {
                        vscode.window.showErrorMessage("An error occured on doing Code Push release");
                    }

                    fileUtils.rmDir(codePushRelaseParams.updatedContentZipPath);
                });
            });
        });
    }

    public showMenu(client: AppCenterClient, appCenterManager: AppCenterExtensionManager): Q.Promise<void>  {
        return Auth.getProfile().then((profile: Profile | null) => {
            let defaultApp: DefaultApp | null = null;
            if (profile && profile.defaultApp) {
                defaultApp = profile.defaultApp;
            }
            let menuPlaceHolederTitle = ACUtils.formatPlaceholderForShowMenuCommand(defaultApp);
            let appCenterMenuOptions = [
                    {
                        label: ACStrings.ReleaseReactMenuLabel,
                        description: ACStrings.ReleaseReactMenuDescription,
                        target: ACCommandNames.CodePushReleaseReact,
                    },
                    {
                        label: ACStrings.SetCurrentAppMenuLabel,
                        description: ACStrings.SetCurrentAppMenuDescription,
                        target: ACCommandNames.SetCurrentApp,
                    },
                    {
                        label: ACStrings.LogoutMenuLabel,
                        description: ACStrings.LogoutMenuDescription,
                        target: ACCommandNames.Logout,
                    },
            ];

            // This item is avaliable only if we have specified app already
            if (profile && profile.defaultApp && profile.defaultApp.currentAppDeployments) {
                // Let logout command be always the last one in the list
                appCenterMenuOptions.splice(appCenterMenuOptions.length - 1, 0,
                    {
                        label: ACStrings.SetCurrentDeploymentMenuLabel,
                        description: ACStrings.SetCurrentDeploymentMenuDescription,
                        target: ACCommandNames.SetCurrentDeployment,
                    }
                );
            }

            return vscode.window.showQuickPick(appCenterMenuOptions, { placeHolder: menuPlaceHolederTitle })
            .then((selected: {label: string, description: string, target: string}) => {
                if (!selected) {
                    // user cancel selection
                    return Q.resolve(void 0);
                }
                switch (selected.target) {
                    case (ACCommandNames.SetCurrentApp):
                        return this.setCurrentApp(client, appCenterManager);

                    case (ACCommandNames.SetCurrentDeployment):
                        return this.setCurrentDeployment(appCenterManager);

                    case (ACCommandNames.CodePushReleaseReact):
                        return this.releaseReact(client, appCenterManager);

                    case (ACCommandNames.Logout):
                        return this.logout(appCenterManager);

                    default:
                        // Ideally shouldn't be there :)
                        this.logger.error("Unknown appcenter show menu command");
                        return Q.resolve(void 0);
                }
            });
        });
    }

    private saveCurrentApp(currentAppName: string, appOS: AppCenterOS, currentAppDeployments: CurrentAppDeployments | null): Q.Promise<DefaultApp | null> {
        const defaultApp = ACUtils.toDefaultApp(currentAppName, appOS, currentAppDeployments);
        if (!defaultApp) {
            vscode.window.showWarningMessage(ACStrings.InvalidCurrentAppNameMsg);
            return Q.resolve(null);
        }

        return Auth.getProfile().then((profile: Profile | null) => {
            if (profile) {
                profile.defaultApp = defaultApp;
                profile.save();
                return Q.resolve(defaultApp);
            } else {
                // No profile - not logged in?
                vscode.window.showWarningMessage(ACStrings.UserIsNotLoggedInMsg);
                return Q.resolve(null);
            }
        });
    }

    private restoreCurrentApp(): Q.Promise<DefaultApp | null> {
        return Auth.getProfile().then((profile: Profile | null) => {
            if (profile && profile.defaultApp) {
                return Q.resolve(profile.defaultApp);
            }
            return Q.resolve(null);
        });
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
            return appCenterManager.setupAppCenterStatusBar(profile);
        });
    }
}