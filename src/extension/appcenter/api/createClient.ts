// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.

import AppCenterClient from "../lib/app-center-node-client/index";
import { AppCenterClientCredentials } from "./appCenterClientCredentials";
import * as Q from "q";
import { Profile } from "../auth/profile/profile";

export interface AppCenterClientFactory {
    fromToken(token: string | Q.Promise<string> | {(): Q.Promise<string>}, endpoint: string): AppCenterClient;
    fromProfile(user: Profile, endpoint: string): AppCenterClient | null;
}

export function createAppCenterClient(): AppCenterClientFactory {
    return {
      fromToken(token: string | Q.Promise<string> | {(): Q.Promise<string>}, endpoint: string): AppCenterClient {
        let tokenFunc: {(): Q.Promise<string>};

        if (typeof token === "string") {
          tokenFunc = () => Q.resolve(<string>token);
        } else if (typeof token === "object") {
          tokenFunc = () => <Q.Promise<string>>token;
        } else {
          tokenFunc = token;
        }
        return new AppCenterClient(new AppCenterClientCredentials(tokenFunc), endpoint);
      },
      fromProfile(user: Profile, endpoint): AppCenterClient | null {
        if (!user) {
          return null;
        }
        return new AppCenterClient(new AppCenterClientCredentials(() => user.accessToken), endpoint);
      },
    };
}

export function getQPromisifiedClientResult<T>(action: Promise<T>): Q.Promise<T> {
  return Q.Promise((resolve, reject) => {
      action.then((result: T) => {
        resolve(result);
      }).catch((e) => {
        reject(e);
      });
  });
}