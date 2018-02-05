// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.

import * as fs from "fs";
import * as path from "path";
import * as mkdirp from "mkdirp";
import * as Q from "q";
import { TokenValueType, tokenStore } from "../tokenStore/index";
import { getProfileDir, profileFile } from "./getProfileDir";
import { DefaultApp } from "../../command/commandParams";

export interface Profile {
    userId: string;
    userName: string;
    displayName: string;
    email: string;
    readonly accessToken: Q.Promise<string>;
    defaultApp?: DefaultApp;
    save(): Profile;
    logout(): Q.Promise<void>;
  }

class ProfileImpl implements Profile {
    public userId: string;
    public userName: string;
    public displayName: string;
    public email: string;
    public defaultApp?: DefaultApp;

    constructor(fileContents: any) {
        this.userId = fileContents.userId || fileContents.id;
        this.userName = fileContents.userName || fileContents.name;
        this.displayName = fileContents.displayName;
        this.email = fileContents.email;
        this.defaultApp = fileContents.defaultApp;
    }

    get accessToken(): Q.Promise<string> {
        const getter = tokenStore.get(this.userName)
          .catch((err: Error) => {
              // log error?
          });
        const emptyToken = "";
        return getter.then((entry: any) => {
            if (entry) {
                return entry.accessToken.token;
            }
            return emptyToken;
        }).catch((err: Error) => {
            // Failed to get token from porfile, return no result
            return emptyToken;
        });
    }

    public save(): Profile {
        let profile: any = {
            userId: this.userId,
            userName: this.userName,
            displayName: this.displayName,
            email: this.email,
            defaultApp: this.defaultApp,
          };

        mkdirp.sync(getProfileDir());
        fs.writeFileSync(getProfileFilename(), JSON.stringify(profile), { encoding: "utf8" });
        return this;
    }

    public logout(): Q.Promise<void> {
        return tokenStore.remove(this.userName).then(() => {
            try {
                fs.unlinkSync(getProfileFilename());
            } catch (err) {
                // File not found is ok, probably doesn't exist
            }
        });
    }
}

let currentProfile: Profile | null;

function getProfileFilename(): string {
    const profileDir = getProfileDir();
    return path.join(profileDir, profileFile);
}

function loadProfile(): Profile | null {
    const profilePath = getProfileFilename();
    if (!fs.existsSync(profilePath)) {
        return null;
    }

    let profileContents = fs.readFileSync(profilePath, "utf8");
    let profile: any = JSON.parse(profileContents);
    return new ProfileImpl(profile);
}

export function getUser(): Profile | null {
    if (!currentProfile) {
      currentProfile = loadProfile();
    }
    return currentProfile;
}

export function saveUser(user: any, token: TokenValueType): Q.Promise<Profile> {
    return tokenStore.set(user.name, token).then(() => {
        let profile = new ProfileImpl(user);
        profile.save();
        return profile;
    });
}

export function deleteUser(): Q.Promise<void> {
    let profile = getUser();
    if (profile) {
      currentProfile = null;
      return profile.logout();
    }
    return Q.resolve(void 0);
}