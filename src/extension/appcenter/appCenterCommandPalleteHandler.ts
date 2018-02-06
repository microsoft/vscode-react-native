// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.

import { ILogger, LogLevel } from "../log/LogHelper";
import * as Q from "q";
import { AppCenterCommandExecutor } from "./command/commandExecutor";
import Auth from "../appcenter/auth/auth";
import * as vscode from "vscode";
import { AppCenterClient } from "./api/index";
import { getUser, Profile } from "./auth/profile/profile";
import { AppCenterClientFactory, createAppCenterClient } from "./api/createClient";
import { SettingsHelper } from "../settingsHelper";
import { AppCenterCommandType } from "./appCenterConstants";
import { AppCenterExtensionManager } from "./appCenterExtensionManager";
import { ACStrings } from "./appCenterStrings";
import { ACUtils } from "./appCenterUtils";

export class AppCenterCommandPalleteHandler {
    private commandExecutor: AppCenterCommandExecutor;
    private client: AppCenterClient;
    private logger: ILogger;
    private clientFactory: AppCenterClientFactory;
    private appCenterManager: AppCenterExtensionManager;

    constructor(logger: ILogger) {
        this.commandExecutor = new AppCenterCommandExecutor(logger);
        this.clientFactory = createAppCenterClient();
        this.logger = logger;
    }

    public set AppCenterManager(manager: AppCenterExtensionManager) {
        this.appCenterManager = manager;
    }

    public run(command: AppCenterCommandType): Q.Promise<void>  {
        if (!ACUtils.isCodePushProject(this.appCenterManager.projectRootPath)) {
            vscode.window.showInformationMessage(ACStrings.NoCodePushDetectedMsg);
            return Q.resolve(void 0);
        }

        // Login is special case
        if (command === AppCenterCommandType.Login) {
            return this.commandExecutor.login(this.appCenterManager);
        }

        return Auth.whoAmI().then((profile: Profile) => {
            if (!profile) {
                vscode.window.showInformationMessage(ACStrings.UserIsNotLoggedInMsg);
                return Q.resolve(void 0);
             } else {
                const clientOrNull: AppCenterClient | null  = this.resolveAppCenterClient();
                if (clientOrNull) {
                    this.client = clientOrNull;

                    switch (command) {
                        case (AppCenterCommandType.Logout):
                            return this.commandExecutor.logout(this.appCenterManager);

                        case (AppCenterCommandType.Whoami):
                            return this.commandExecutor.whoAmI(profile);

                        case (AppCenterCommandType.SetCurrentApp):
                            return this.commandExecutor.setCurrentApp(this.client, this.appCenterManager);

                        case (AppCenterCommandType.GetCurrentApp):
                            return this.commandExecutor.getCurrentApp();

                        case (AppCenterCommandType.CodePushReleaseReact):
                            return this.commandExecutor.releaseReact(this.client, this.appCenterManager);

                        default:
                            throw new Error("Unknown App Center command!");
                    }
                } else {
                    this.logger.log("Failed to get App Center client", LogLevel.Error);
                    throw new Error("Failed to get App Center client!");
                }
             }
        });
    }

    private resolveAppCenterClient(): AppCenterClient | null {
        if (!this.client) {
            const user = getUser();
            if (user) {
                return this.clientFactory.fromProfile(user, SettingsHelper.getAppCenterAPIEndpoint());
            } else {
                throw new Error("No App Center user specified");
            }
        }
        return this.client;
    }
}