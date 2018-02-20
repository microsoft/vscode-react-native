// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.

import { ILogger, LogLevel } from "../log/LogHelper";
import * as Q from "q";
import { AppCenterCommandExecutor } from "./command/commandExecutor";
import Auth from "../appcenter/auth/auth";
import { AppCenterClient } from "./api/index";
import { Profile } from "./auth/profile/profile";
import { AppCenterClientFactory, createAppCenterClient } from "./api/createClient";
import { SettingsHelper } from "../settingsHelper";
import { AppCenterCommandType } from "./appCenterConstants";
import { AppCenterExtensionManager } from "./appCenterExtensionManager";
import { ACStrings } from "./appCenterStrings";
import { ACUtils } from "./helpers/utils";
import { VsCodeUtils } from "./helpers/vscodeUtils";

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
        return ACUtils.isCodePushProject(this.appCenterManager.projectRootPath).then((isCodePush: boolean) => {
            if (!isCodePush) {
                VsCodeUtils.ShowWarningMessage(ACStrings.NoCodePushDetectedMsg);
                return Q.resolve(void 0);
            } else {
                // Login is special case
                if (command === AppCenterCommandType.Login) {
                    return this.commandExecutor.login(this.appCenterManager);
                }

                return Auth.getProfile(this.appCenterManager.projectRootPath).then((profile: Profile) => {
                    if (!profile) {
                        VsCodeUtils.ShowWarningMessage(ACStrings.UserIsNotLoggedInMsg);
                        return Q.resolve(void 0);
                    } else {
                        const clientOrNull: AppCenterClient | null  = this.resolveAppCenterClient(profile);
                        if (clientOrNull) {
                            this.client = clientOrNull;

                            switch (command) {
                                case (AppCenterCommandType.Logout):
                                    return this.commandExecutor.logout(this.appCenterManager);

                                case (AppCenterCommandType.Whoami):
                                    return this.commandExecutor.whoAmI(this.appCenterManager);

                                case (AppCenterCommandType.SetCurrentApp):
                                    return this.commandExecutor.setCurrentApp(this.client, this.appCenterManager);

                                case (AppCenterCommandType.GetCurrentApp):
                                    return this.commandExecutor.getCurrentApp(this.appCenterManager);

                                case (AppCenterCommandType.SetCurrentDeployment):
                                    return this.commandExecutor.setCurrentDeployment(this.appCenterManager);

                                case (AppCenterCommandType.CodePushReleaseReact):
                                    return this.commandExecutor.releaseReact(this.client, this.appCenterManager);

                                case (AppCenterCommandType.ShowMenu):
                                    return this.commandExecutor.showMenu(this.client, this.appCenterManager);

                                case (AppCenterCommandType.SwitchMandatoryPropForRelease):
                                    return this.commandExecutor.switchIsMandatoryForRelease(this.appCenterManager);

                                case (AppCenterCommandType.SetTargetBinaryVersionForRelease):
                                    return this.commandExecutor.setTargetBinaryVersionForRelease(this.appCenterManager);

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
        });
    }

    private resolveAppCenterClient(profile: Profile): AppCenterClient | null {
        if (!this.client) {
            if (profile) {
                return this.clientFactory.fromProfile(profile, SettingsHelper.getAppCenterAPIEndpoint());
            } else {
                throw new Error("No App Center user specified!");
            }
        }
        return this.client;
    }
}