// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.

import * as Q from "q";
import { SettingsHelper } from "../../../extension/settingsHelper";
import { createAppCenterClient, getQPromisifiedResult } from "../api/index";
import { Profile, saveUser, deleteUser, getUser } from "../auth/profile/profile";
import * as models from "app-center-node-client/models";

export default class Auth {
    public static isAuthenticated(): Q.Promise<boolean> {
        const currentUser = getUser();
        if (currentUser) {
            return Q<boolean>(true);
        } else {
            return Q<boolean>(false);
        }
    }

    public static whoAmI(): Q.Promise<string> {
        const currentUser = getUser();
        if (currentUser) {
            return Q.resolve(currentUser.displayName);
        } else {
            return Q.resolve("");
        }
    }

    // public static doInteractiveLogin(): Q.Promise<void> {
    //     return this.removeLoggedInUser().then(() => {
    //         const loginUrl = SettingsHelper.getAppCenterLoginEndpoint() + "?" + qs.stringify({ hostname: os.hostname()});
    //         vscode.window.showInformationMessage("Please login to AppCenter in the browser window we will open, then enter your token from the browser to vscode", ...["OK"]).then(() => {
    //             opener(loginUrl);
    //             vscode.window.showInputBox({ prompt: "Please provide token to authenticate", ignoreFocusOut: true }).then(token => {
    //                 if (token) {
    //                     Auth.fetchUserInfoByTokenAndSave(token).then((profile: Profile) => {
    //                         vscode.window.showInformationMessage(`Successfully logged in as ${profile.displayName}`);
    //                     });
    //                 }
    //             });
    //         });
    //     });
    // }

    public static doTokenLogin(token: string): Q.Promise<Profile | null> {
        if (!token) {
            return Q.resolve(null);
        }
        return this.removeLoggedInUser().then(() => {
            return Auth.fetchUserInfoByTokenAndSave(token).then((profile: Profile) => {
                return Q.resolve(profile);
            });
        });
    }

    public static doLogout(): Q.Promise<void> {
        // TODO: Probably we need to delete token from server also?
        return this.removeLoggedInUser();
    }

    private static fetchUserInfoByTokenAndSave(token: string): Q.Promise<Profile>  {
        return Auth.getUserInfo(token).then(userResponse => {
            return saveUser(userResponse, { token: token }).then((profile: Profile) => {
                return Q.resolve(profile);
            });
        }).catch((e: any) => {
            throw e;
        });
    }

    private static getUserInfo(token: string): Q.Promise<models.UserProfileResponse> {
        const client = createAppCenterClient().fromToken(token, SettingsHelper.getAppCenterAPIEndpoint());
        return getQPromisifiedResult(client.account.users.get());
    }

    private static removeLoggedInUser(): Q.Promise<void> {
        const currentUser = getUser();
        if (currentUser) {
            // Deleting user token from token store
            return deleteUser().then(() => {
                return Q.resolve(void 0);
            }).catch(() => { }); // Noop, it's ok if deletion fails
        }
        return Q.resolve(void 0);
    }
}