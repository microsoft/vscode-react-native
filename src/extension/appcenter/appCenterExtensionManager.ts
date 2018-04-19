// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.

import { Disposable, StatusBarAlignment, StatusBarItem, window } from "vscode";
import Auth from "../appcenter/auth/auth";
import { ACStrings } from "./appCenterStrings";
import * as Q from "q";
import { ACCommandNames, ACConstants } from "./appCenterConstants";
import { Profile } from "./auth/profile/profile";
import { ACUtils } from "./helpers/utils";
import { VsCodeUtils } from "./helpers/vscodeUtils";

export class AppCenterExtensionManager implements Disposable {
    private appCenterStatusBarItem: StatusBarItem;
    private _projectRootPath: string;

    public constructor(projectRootPath: string) {
        this._projectRootPath = projectRootPath;
    }

    public get projectRootPath(): string {
        return this._projectRootPath;
    }

    public setup(): Q.Promise<void>  {
        return ACUtils.isCodePushProject(this._projectRootPath).then((isCodePush: boolean) => {
            if (!isCodePush) {
                return Q.resolve(void 0);
            } else {
                this.appCenterStatusBarItem = window.createStatusBarItem(StatusBarAlignment.Left, 12);
                return Auth.getProfile(this._projectRootPath).then((profile: Profile | null) => {
                    return this.setupAppCenterStatusBar(profile);
                });
            }
        });
    }

    public dispose() {
        if (this.appCenterStatusBarItem) {
            this.appCenterStatusBarItem.dispose();
        }
    }

    public setupAppCenterStatusBar(profile: Profile | null): Q.Promise<void> {
        if (profile && profile.userName) {
            return VsCodeUtils.setStatusBar(this.appCenterStatusBarItem,
                `$(icon octicon-person) ${profile.userName}`,
                ACStrings.YouAreLoggedInMsg(profile.userName),
                `${ACConstants.ExtensionPrefixName}.${ACCommandNames.ShowMenu}`
            );
        }
        return VsCodeUtils.setStatusBar(this.appCenterStatusBarItem,
            `$(icon octicon-sign-in) ${ACStrings.LoginToAppCenterButton}`,
            ACStrings.UserMustSignIn,
            `${ACConstants.ExtensionPrefixName}.${ACCommandNames.Login}`
        );
    }
}