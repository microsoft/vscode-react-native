// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.

// tslint:disable-next-line:no-var-requires
const opener = require("opener");
// tslint:disable-next-line:no-var-requires
const open = require("open");
import * as Q from "q";
import * as fs from "fs";
import * as path from "path";
import { Package, IPackageInformation } from "../../common/node/package";
import { ACConstants, AppCenterOS, CurrentAppDeployments } from "./appCenterConstants";
import { DefaultApp } from "./command/commandParams";
import { ACStrings } from "./appCenterStrings";

export class ACUtils {
    private static validApp = /^([a-zA-Z0-9-_.]{1,100})\/([a-zA-Z0-9-_.]{1,100})$/;

    // Use open for Windows and Mac, opener for Linux
    public static OpenUrl(url: string): void {
        switch (process.platform) {
            case "win32":
            case "darwin":
                open(url);
                break;
            default:
                opener(url);
                break;
        }
    }

    public static isCodePushProject(projectRoot: string): Q.Promise<boolean> {
        if (!projectRoot || !fs.existsSync(path.join(projectRoot, "package.json"))) {
            return Q<boolean>(false);
        }
        return new Package(projectRoot).parsePackageInformation().then((packageInfo: IPackageInformation) => {
            if (packageInfo.dependencies && packageInfo.dependencies[ACConstants.CodePushNpmPackageName]) {
                return Q<boolean>(true);
            } else {
                return Q<boolean>(false);
            }
        });
    }

    public static formatPlaceholderForShowMenuCommand(defaultApp: DefaultApp | null): string {
        if (defaultApp) {
            if (!defaultApp.currentAppDeployments) {
                return ACStrings.YourCurrentAppAndDeployemntMsg(`${ACUtils.formatAppName(defaultApp)})`, "");
            } else {
                return ACStrings.YourCurrentAppAndDeployemntMsg(`${defaultApp.appName} (${defaultApp.os})`, defaultApp.currentAppDeployments.currentDeploymentName);
            }
        } else {
            return ACStrings.NoCurrentAppSetMsg;
        }
    }

    public static formatDeploymentNameForStatusBar(deployment: CurrentAppDeployments): string {
        return deployment.currentDeploymentName;
    }

    public static formatAppName(app: DefaultApp): string | null {
        if (app) {
            return `${app.appName} (${app.os})`;
        }
        return null;
    }

    public static toDefaultApp(app: string, appOS: AppCenterOS, appDeployment: CurrentAppDeployments | null): DefaultApp | null {
        const matches = app.match(this.validApp);
        if (matches !== null) {
          return {
            ownerName: matches[1],
            appName: matches[2],
            identifier: `${matches[1]}/${matches[2]}`,
            os: appOS,
            currentAppDeployments: appDeployment ? appDeployment : {
                codePushDeployments: new Array(),
                currentDeploymentName: "",
            },
          };
        }
        return null;
      }
}
