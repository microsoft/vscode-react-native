// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.

import { models } from "./api/index";

export class ACConstants {
    public static ExtensionPrefixName: string = "reactNative";
    public static AppCenterExtensionName: string = "appcenter";
    public static DefaulAPIEndPoint: string = "https://api.appcenter.ms";
    public static DefaultLoginEndPoint: string = "https://appcenter.ms/cli-login";
    public static CodePushNpmPackageName: string = "react-native-code-push";
    public static AppCenterReactNativePlatformName: string = "React-Native";
    public static AppCenterCodePushStatusBarColor: string = "#F3F3B2";
}

export class ACCommandNames {
    public static CommandPrefix: string = ACConstants.AppCenterExtensionName + ".";
    public static Login: string = ACCommandNames.CommandPrefix + "login";
    public static Logout: string = ACCommandNames.CommandPrefix + "logout";
    public static WhoAmI: string = ACCommandNames.CommandPrefix + "whoami";
    public static SetCurrentApp: string = ACCommandNames.CommandPrefix + "setcurrentapp";
    public static GetCurrentApp: string = ACCommandNames.CommandPrefix + "getcurrentapp";
    public static SetCurrentDeployment: string = ACCommandNames.CommandPrefix + "setcurrentdeployment";
    public static CodePushReleaseReact: string = ACCommandNames.CommandPrefix + "releasereact";
    public static AppCenterShowMenu: string = ACCommandNames.CommandPrefix + "showmenu";
}

export interface CurrentAppDeployments {
    currentDeploymentName: string;
    codePushDeployments: models.Deployment[];
}

export enum AppCenterOS {
    iOS = "iOS",
    Android = "Android",
}

export enum AppCenterLoginType {
    Interactive,
    Token,
}

export enum AppCenterCommandType {
    // Auth commands
    Login = 1,
    Logout,
    Whoami,

    // App commands
    SetCurrentApp,
    GetCurrentApp,

    // Deployment commands
    SetCurrentDeployment,

    // CodePush commands
    CodePushReleaseReact,

    // Common commands
    ShowMenu,
}