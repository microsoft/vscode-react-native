// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.

import * as vscode from "vscode";
import * as Q from "q";
import * as qs from "qs";
import * as os from "os";

import { ILogger, LogLevel } from "../../log/LogHelper";
import Auth from "../../appcenter/auth/auth";
import { AppCenterLoginType, ACConstants, AppCenterOS, CurrentAppDeployments, Deployment, ACCommandNames } from "../appCenterConstants";
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
import { validRange } from "semver";

interface IAppCenterAuth {
    login(appcenterManager: AppCenterExtensionManager): Q.Promise<void>;
    logout(appcenterManager: AppCenterExtensionManager): Q.Promise<void>;
    whoAmI(profile: Profile): Q.Promise<void>;
}

interface IAppCenterApps {
    getCurrentApp(appCenterManager: AppCenterExtensionManager): Q.Promise<void>;
    setCurrentApp(client: AppCenterClient, appCenterManager: AppCenterExtensionManager): Q.Promise<void>;

    setCurrentDeployment(appCenterManager: AppCenterExtensionManager): Q.Promise<void>;
}

interface IAppCenterCodePush {
    showMenu(client: AppCenterClient, appCenterManager: AppCenterExtensionManager): Q.Promise<void>;
    releaseReact(client: AppCenterClient, appCenterManager: AppCenterExtensionManager): Q.Promise<void>;
    switchIsMandatoryForRelease(appCenterManager: AppCenterExtensionManager): Q.Promise<void>;
    setTargetBinaryVersionForRelease(appCenterManager: AppCenterExtensionManager): Q.Promise<void>;
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
        return Auth.doLogout(appCenterManager.projectRootPath).then(() => {
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
        this.restoreCurrentApp(appCenterManager.projectRootPath)
            .then((currentApp: DefaultApp) => {
                if (currentApp && currentApp.currentAppDeployments && currentApp.currentAppDeployments.codePushDeployments) {
                    const deploymentOptions: string[] = currentApp.currentAppDeployments.codePushDeployments.map((deployment) => {
                        return deployment.name;
                    });
                    vscode.window.showQuickPick(deploymentOptions, { placeHolder: ACStrings.SelectCurrentDeploymentMsg })
                    .then((deploymentName) => {
                        if (deploymentName) {
                            this.saveCurrentApp(
                                appCenterManager.projectRootPath,
                                currentApp.identifier,
                                AppCenterOS[currentApp.os], {
                                currentDeploymentName: deploymentName,
                                codePushDeployments: currentApp.currentAppDeployments.codePushDeployments,
                            },
                            currentApp.targetBinaryVersion,
                            currentApp.isMandatory
                        );
                    }
                });
            }
        });
        return Q.resolve(void 0);
    }

    public getCurrentApp(appCenterManager: AppCenterExtensionManager): Q.Promise<void> {
        this.restoreCurrentApp(appCenterManager.projectRootPath).then((app: DefaultApp) => {
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
                        const OS: AppCenterOS = AppCenterOS[selectedApp.os.toLowerCase()];

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
                                const deployments: Deployment[] = appDeployments.map((d) => {
                                    return {
                                        name: d.name,
                                    };
                                });
                                currentDeployments = {
                                    codePushDeployments: deployments,
                                    currentDeploymentName: appDeployments[0].name, // Select 1st one by default
                                };
                            }
                            this.saveCurrentApp(
                                appCenterManager.projectRootPath,
                                selectedAppName,
                                OS,
                                currentDeployments,
                                ACConstants.AppCenterDefaultTargetBinaryVersion,
                                ACConstants.AppCenterDefaultIsMandatoryParam)
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
        return Q.Promise<any>((resolve, reject) => {
            let updateContentsDirectory: string;
            let isMandatory: boolean;
            vscode.window.withProgress({ location: vscode.ProgressLocation.Window, title: "Get Apps" }, p => {
                return new Promise<DefaultApp>((appResolve, appReject) => {
                    p.report({ message: ACStrings.GettingAppInfoMessage });
                    this.restoreCurrentApp(appCenterManager.projectRootPath)
                        .then((currentApp: DefaultApp) => appResolve(<DefaultApp>currentApp))
                        .catch(err => appReject(err));
                }).then((currentApp: DefaultApp): any => {
                    p.report({ message: ACStrings.DetectingAppVersionMessage });
                    if (!currentApp) {
                        throw new Error(`No current app has been specified.`);
                    }
                    if (!currentApp.os || !reactNative.isValidOS(currentApp.os)) {
                        throw new Error(`OS must be "android", "ios", or "windows".`);
                    }
                    codePushRelaseParams.app = currentApp;
                    codePushRelaseParams.deploymentName = currentApp.currentAppDeployments.currentDeploymentName;
                    currentApp.os = currentApp.os.toLowerCase();
                    isMandatory = !!currentApp.isMandatory;
                    if (currentApp.targetBinaryVersion !== ACConstants.AppCenterDefaultTargetBinaryVersion) {
                        return currentApp.targetBinaryVersion;
                    } else {
                        switch (currentApp.os) {
                            case "android": return reactNative.getAndroidAppVersion(projectRootPath);
                            case "ios": return reactNative.getiOSAppVersion(projectRootPath);
                            case "windows": return reactNative.getWindowsAppVersion(projectRootPath);
                            default: throw new Error(`OS must be "android", "ios", or "windows".`);
                        }
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
                    this.logger.log(`CodePush updated contents directory path: ${updateContentsDirectory}`, LogLevel.Debug);
                    return updateContents.zip(pathToUpdateContents, projectRootPath);
                }).then((pathToZippedBundle: string) => {
                    p.report({ message: ACStrings.ReleasingUpdateContentsMessage });
                    codePushRelaseParams.updatedContentZipPath = pathToZippedBundle;
                    codePushRelaseParams.isMandatory = isMandatory;
                    return new Promise<any>((publishResolve, publishReject) => {
                        CodePushReleaseReact.exec(client, codePushRelaseParams, this.logger)
                            .then((response: any) => publishResolve(response))
                            .catch((error: any) => publishReject(error));
                    });
                }).then((response: any) => {
                    if (response.succeeded && response.result) {
                        vscode.window.showInformationMessage(`Successfully released an update to the "${codePushRelaseParams.deploymentName}" deployment of the "${codePushRelaseParams.app.appName}" app`);
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
        return Auth.getProfile(appCenterManager.projectRootPath).then((profile: Profile | null) => {
            let defaultApp: DefaultApp | null = null;
            if (profile && profile.defaultApp) {
                defaultApp = profile.defaultApp;
            }
            let menuPlaceHolederTitle = ACStrings.MenuTitlePlaceholder;
            let appCenterMenuOptions = [
                    {
                        label: ACStrings.ReleaseReactMenuText(defaultApp),
                        description: "",
                        target: ACCommandNames.CodePushReleaseReact,
                    },
                    {
                        label: ACStrings.SetCurrentAppMenuText(defaultApp),
                        description: "",
                        target: ACCommandNames.SetCurrentApp,
                    },
                    {
                        label: ACStrings.LogoutMenuLabel,
                        description: "",
                        target: ACCommandNames.Logout,
                    },
            ];

            // This item is avaliable only if we have specified app already
            if (defaultApp && defaultApp.currentAppDeployments) {
                // Let logout command be always the last one in the list
                appCenterMenuOptions.splice(appCenterMenuOptions.length - 1, 0,
                    {
                        label: ACStrings.SetCurrentAppDeploymentText(defaultApp),
                        description: "",
                        target: ACCommandNames.SetCurrentDeployment,
                    }
                );
                appCenterMenuOptions.splice(appCenterMenuOptions.length - 1, 0,
                    {
                        label: ACStrings.SetCurrentAppTargetBinaryVersionText(defaultApp),
                        description: "",
                        target: ACCommandNames.SetTargetBinaryVersionForRelease,
                    }
                );
                appCenterMenuOptions.splice(appCenterMenuOptions.length - 1, 0,
                    {
                        label: ACStrings.SetCurrentAppIsMandatoryText(defaultApp),
                        description: "",
                        target: ACCommandNames.SwitchMandatoryPropertyForRelease,
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

                    case (ACCommandNames.SetTargetBinaryVersionForRelease):
                        return this.setTargetBinaryVersionForRelease(appCenterManager);

                    case (ACCommandNames.SwitchMandatoryPropertyForRelease):
                        return this.switchIsMandatoryForRelease(appCenterManager);

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

    public switchIsMandatoryForRelease(appCenterManager: AppCenterExtensionManager): Q.Promise<void> {
        this.restoreCurrentApp(appCenterManager.projectRootPath).then((app: DefaultApp) => {
            if (app) {
                const newMandatoryValue = !!!app.isMandatory;
                const osVal: AppCenterOS = AppCenterOS[app.os];
                this.saveCurrentApp(
                    appCenterManager.projectRootPath,
                    app.identifier,
                    osVal, {
                    currentDeploymentName: app.currentAppDeployments.currentDeploymentName,
                    codePushDeployments: app.currentAppDeployments.codePushDeployments,
                },
                    app.targetBinaryVersion,
                    newMandatoryValue
                ).then(() => {
                    vscode.window.showInformationMessage(`Changed release to ${newMandatoryValue ? "Mandotory" : "NOT Mandatory"}`);
                });
            } else {
                vscode.window.showInformationMessage(ACStrings.NoCurrentAppSetMsg);
            }
        });
        return Q.resolve(void 0);
    }

    public setTargetBinaryVersionForRelease(appCenterManager: AppCenterExtensionManager): Q.Promise<void> {
        vscode.window.showInputBox({ prompt: ACStrings.PleaseProvideTargetBinaryVersion, ignoreFocusOut: true })
        .then(appVersion => {
            if (appVersion && !!validRange(appVersion)) {
                return this.restoreCurrentApp(appCenterManager.projectRootPath).then((app: DefaultApp) => {
                    if (app) {
                        return this.saveCurrentApp(
                            appCenterManager.projectRootPath,
                            app.identifier,
                            AppCenterOS[app.os], {
                            currentDeploymentName: app.currentAppDeployments.currentDeploymentName,
                            codePushDeployments: app.currentAppDeployments.codePushDeployments,
                        },
                            appVersion,
                            app.isMandatory
                        ).then(() => {
                            vscode.window.showInformationMessage(`Changed target binary version to ${appVersion}`);
                        });
                    } else {
                        vscode.window.showInformationMessage(ACStrings.NoCurrentAppSetMsg);
                        return Q.resolve(void 0);
                    }
                });
            } else {
                vscode.window.showWarningMessage(ACStrings.InvalidAppVersionParamMsg);
                return Q.resolve(void 0);
            }
        });
        return Q.resolve(void 0);
    }

    private saveCurrentApp(projectRootPath: string,
                           currentAppName: string,
                           appOS: AppCenterOS,
                           currentAppDeployments: CurrentAppDeployments | null,
                           targetBinaryVersion: string,
                           isMandatory: boolean): Q.Promise<DefaultApp | null> {
        const defaultApp = ACUtils.toDefaultApp(currentAppName, appOS, currentAppDeployments, targetBinaryVersion, isMandatory);
        if (!defaultApp) {
            vscode.window.showWarningMessage(ACStrings.InvalidCurrentAppNameMsg);
            return Q.resolve(null);
        }

        return Auth.getProfile(projectRootPath).then((profile: Profile | null) => {
            if (profile) {
                profile.defaultApp = defaultApp;
                profile.save(projectRootPath);
                return Q.resolve(defaultApp);
            } else {
                // No profile - not logged in?
                vscode.window.showWarningMessage(ACStrings.UserIsNotLoggedInMsg);
                return Q.resolve(null);
            }
        });
    }

    private restoreCurrentApp(projectRootPath: string): Q.Promise<DefaultApp | null> {
        return Auth.getProfile(projectRootPath).then((profile: Profile | null) => {
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
        return Auth.doTokenLogin(token, appCenterManager.projectRootPath).then((profile: Profile) => {
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