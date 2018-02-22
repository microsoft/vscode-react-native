// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.

import * as Q from "q";
import { SettingsHelper } from "../../../extension/settingsHelper";
import { createAppCenterClient, getQPromisifiedClientResult } from "../api/index";
import { Profile, saveUser, deleteUser, getUser } from "../auth/profile/profile";
import * as models from "app-center-node-client/models";

export default class Auth {
    public static getProfile(projectRootPath: string): Q.Promise<Profile | null> {
        const profile: Profile | null = getUser(projectRootPath);
        if (profile) {
            return Q.resolve(profile);
        } else {
            return Q.resolve(null);
        }
    }

    public static doTokenLogin(token: string, projectRootPath: string): Q.Promise<Profile | null> {
        if (!token) {
            return Q.resolve(null);
        }
        return this.removeLoggedInUser(projectRootPath).then(() => {
            return Auth.fetchUserInfoByTokenAndSave(token, projectRootPath).then((profile: Profile) => {
                return Q.resolve(profile);
            }).catch((e: Error) => {
                return Q.resolve(null);
            });
        });
    }

    public static doLogout(projectRootPath: string): Q.Promise<void> {
        // TODO: Probably we need to delete token from server also?
        return this.removeLoggedInUser(projectRootPath);
    }

    private static fetchUserInfoByTokenAndSave(token: string, projectRootPath: string): Q.Promise<Profile>  {
        return Auth.getUserInfo(token).then(userResponse => {
            return saveUser(userResponse, { token: token }, projectRootPath).then((profile: Profile) => {
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

    private static removeLoggedInUser(projectRootPath: string): Q.Promise<void> {
        return deleteUser(projectRootPath).then(() => {
            return Q.resolve(void 0);
        }).catch(() => { }); // Noop, it's ok if deletion fails
    }
}