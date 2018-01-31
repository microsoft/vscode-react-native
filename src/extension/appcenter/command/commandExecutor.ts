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
import { AppCenterLoginType } from "../../appcenter/auth/appCenterLoginType";
import { Profile } from "../../appcenter/auth/profile/profile";
import { SettingsHelper } from "../../settingsHelper";
import { AppCenterClient } from "../api/index";
import { CodePushDeploymentList } from "../codepush/index";

interface IAppCenterAuth {
    login(): Q.Promise<void>;
    logout(client: AppCenterClient): Q.Promise<void>;
    whoAmI(client: AppCenterClient): Q.Promise<void>;
}

interface IAppCenterCodePush {
    codePushDeploymentList(client: AppCenterClient): Q.Promise<void>;
}

export class AppCenterCommandExecutor implements IAppCenterAuth, IAppCenterCodePush {
    private logger: ILogger;

    constructor(logger: ILogger) {
        this.logger = logger;
    }

    public login(): Q.Promise<void> {
        return Auth.isAuthenticated().then((isAuthenticated: boolean) => {
            if (isAuthenticated) {
                vscode.window.showInformationMessage("You are already logged in to AppCenter, please logout first if needed");
                return Q.resolve(void 0);
            } else {
                const appCenterLoginOptions: string[] = Object.keys(AppCenterLoginType).filter(k => typeof AppCenterLoginType[k as any] === "number");
                vscode.window.showQuickPick(appCenterLoginOptions, { placeHolder: "Please select the way you would like to login to AppCenter" })
                        .then((loginType) => {
                            switch (loginType) {
                                case (AppCenterLoginType[AppCenterLoginType.Interactive]):
                                    const loginUrl = SettingsHelper.getAppCenterLoginEndpoint() + "?" + qs.stringify({ hostname: os.hostname()});
                                    vscode.window.showInformationMessage("Please login to AppCenter in the browser window we will open, then enter your token from the browser to vscode", ...["OK"])
                                    .then(() => {
                                        opener(loginUrl);
                                        vscode.window.showInputBox({ prompt: "Please provide token to authenticate", ignoreFocusOut: true }).then(token => {
                                            if (token) {
                                                return Auth.doTokenLogin(token).then((profile: Profile) => {
                                                    vscode.window.showInformationMessage(`Successfully logged in as ${profile.displayName}`);
                                                });
                                            } else { return Q.resolve(void 0); }
                                        });
                                    });
                                    break;
                                case (AppCenterLoginType[AppCenterLoginType.Token]):
                                    vscode.window.showInputBox({ prompt: "Please provide token to authenticate" , ignoreFocusOut: true}).then(token => {
                                        if (token) {
                                            return Auth.doTokenLogin(token).then((profile: Profile) => {
                                                vscode.window.showInformationMessage(`Successfully logged in as ${profile.displayName}`);
                                            });
                                        } else { return Q.resolve(void 0); }
                                    });
                                    break;
                                default:
                                    throw new Error("Unsupported login parameter!");
                            }
                        });
                }
            return Q.resolve(void 0);
        });
    }

    public logout(client: AppCenterClient): Q.Promise<void> {
        return Auth.doLogout().then(() => {
            vscode.window.showInformationMessage("Successfully logged out from AppCenter");
        }).catch(() => {
            this.logger.log("An errro occured on logout", LogLevel.Error);
        });
    }

    public whoAmI(client: AppCenterClient): Q.Promise<void> {
        return Auth.whoAmI().then((displayName: string) => {
            if (displayName) {
                vscode.window.showInformationMessage(`You are logged in as ${displayName}`);
            } else {
                vscode.window.showInformationMessage(`You are not logged in to AppCenter`);
            }
        });
    }

    public codePushDeploymentList(client: AppCenterClient): Q.Promise<void> {
        let params: any = {};
        params.app = {};
        // TODO: get it for real!
        params.app.appName = "UpdatedViaCLI";
        params.app.ownerName = "max-mironov";
        params.app.identifier = "max-mironov/UpdatedViaClI";

        return CodePushDeploymentList.exec(<AppCenterClient>client, params, this.logger);
    }
}