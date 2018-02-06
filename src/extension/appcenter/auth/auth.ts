// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.

import * as Q from "q";
import { SettingsHelper } from "../../../extension/settingsHelper";
import { createAppCenterClient, getQPromisifiedClientResult } from "../api/index";
import { Profile, saveUser, deleteUser, getUser } from "../auth/profile/profile";
import * as models from "app-center-node-client/models";

export default class Auth {
    public static whoAmI(): Q.Promise<Profile | null> {
        const currentUser = getUser();
        if (currentUser) {
            return Q.resolve(currentUser);
        } else {
            return Q.resolve(null);
        }
    }

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
        return getQPromisifiedClientResult(client.account.users.get());
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