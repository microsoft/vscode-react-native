// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.

import * as vscode from "vscode";
import * as nls from "vscode-nls";
import { AppLauncher } from "../../appLauncher";
import {
    IAndroidRunOptions,
    IIOSRunOptions,
    ImacOSRunOptions,
    IWindowsRunOptions,
    PlatformType,
} from "../../launchArgs";
import { OutputChannelLogger } from "../../log/OutputChannelLogger";
import { SettingsHelper } from "../../settingsHelper";
import { TargetType } from "../../generalPlatform";
import { CommandExecutor } from "../../../common/commandExecutor";

nls.config({
    messageFormat: nls.MessageFormat.bundle,
    bundleFormat: nls.BundleFormat.standalone,
})();
const localize = nls.loadMessageBundle();

export const getRunOptions = (
    project: AppLauncher,
    platform: PlatformType,
    target: TargetType = TargetType.Simulator,
) => {
    const folderUri = project.getWorkspaceFolderUri();

    const runOptions: IAndroidRunOptions | IIOSRunOptions | IWindowsRunOptions | ImacOSRunOptions =
        {
            platform,
            packagerPort: SettingsHelper.getPackagerPort(folderUri.fsPath),
            runArguments: SettingsHelper.getRunArgs(platform, target, folderUri),
            env: SettingsHelper.getEnvArgs(platform, target, folderUri),
            envFile: SettingsHelper.getEnvFile(platform, target, folderUri),
            projectRoot: SettingsHelper.getReactNativeProjectRoot(folderUri.fsPath),
            nodeModulesRoot: project.getOrUpdateNodeModulesRoot(),
            reactNativeVersions: project.getReactNativeVersions() || {
                reactNativeVersion: "",
                reactNativeWindowsVersion: "",
                reactNativeMacOSVersion: "",
            },
            workspaceRoot: project.getWorkspaceFolderUri().fsPath,
            ...(platform === PlatformType.iOS && target === "device" && { target: "device" }),
        };

    CommandExecutor.ReactNativeCommand = SettingsHelper.getReactNativeGlobalCommandName(
        project.getWorkspaceFolderUri(),
    );

    return runOptions;
};

export const loginToExponent = (project: AppLauncher): Promise<xdl.IUser> => {
    return project
        .getExponentHelper()
        .loginToExponent(
            (message, password) =>
                new Promise(
                    vscode.window.showInputBox({ placeHolder: message, password }).then,
                ).then(it => it || ""),
            message =>
                new Promise(vscode.window.showInformationMessage(message).then).then(
                    it => it || "",
                ),
        )
        .catch(err => {
            OutputChannelLogger.getMainChannel().warning(
                localize(
                    "ExpoErrorOccuredMakeSureYouAreLoggedIn",
                    "An error has occured. Please make sure you are logged in to Expo, your project is setup correctly for publishing and your packager is running as Expo.",
                ),
            );
            throw err;
        });
};
