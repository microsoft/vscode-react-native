// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.

export class ACConstants {
    public static ExtensionPrefixName: string = "reactNative";
    public static AppCenterExtensionName: string = "appcenter";
    public static DefaulAPIEndPoint: string = "https://api.appcenter.ms";
    public static DefaultLoginEndPoint: string = "https://appcenter.ms/cli-login";
    public static DefaultLegacyCodePushService: string = "https://codepush-management.azurewebsites.net/";
    public static CodePushNpmPackageName: string = "react-native-code-push";
    public static AppCenterReactNativePlatformName: string = "React-Native";
    public static AppCenterCodePushStatusBarColor: string = "#F3F3B2";
    public static AppCenterDefaultTargetBinaryVersion: string = "";
    public static AppCenterDefaultIsMandatoryParam: boolean = false;
    public static AppCenterExtId: string = "vsmobile.vscode-appcenter";
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
    public static ShowMenu: string = ACCommandNames.CommandPrefix + "showmenu";
    public static SwitchMandatoryPropertyForRelease: string = ACCommandNames.CommandPrefix + "switchMandatoryPropForRelease";
    public static SetTargetBinaryVersionForRelease: string = ACCommandNames.CommandPrefix + "setTargetBinaryVersion";
}

export interface Deployment {
    name: string;
}

export interface CurrentAppDeployments {
    currentDeploymentName: string;
    codePushDeployments: Deployment[];
}

export enum AppCenterOS {
    ios = "ios",
    android = "android",
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
    SwitchMandatoryPropForRelease,
    SetTargetBinaryVersionForRelease,

    // Common commands
    ShowMenu,
}

export enum MessageTypes {
    Error = 0,
    Warn = 1,
    Info = 2,
}