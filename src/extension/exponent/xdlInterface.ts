// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.

import { join as pathJoin } from "path";
import * as XDLPackage from "xdl";
import * as MetroConfigPackage from "metro-config";
import { PackageLoader, PackageConfig } from "../../common/packageLoader";
import { removeModuleFromRequireCacheByName } from "../../common/utils";
import { SettingsHelper } from "../settingsHelper";

const XDL_PACKAGE = "xdl";
const METRO_CONFIG_PACKAGE = "@expo/metro-config";

const xdlPackageConfig = new PackageConfig(
    XDL_PACKAGE,
    SettingsHelper.getExpoDependencyVersion(XDL_PACKAGE),
);
const metroConfigPackageConfig = new PackageConfig(
    METRO_CONFIG_PACKAGE,
    SettingsHelper.getExpoDependencyVersion(METRO_CONFIG_PACKAGE),
);

const ngrokPackageConfig = new PackageConfig(
    xdlPackageConfig.getPackageName(),
    xdlPackageConfig.getVersion(),
    "build/start/resolveNgrok",
);

// There is the problem with '--no-save' flag for 'npm install' command for npm v6.
// Installing npm dependencies with the `--no-save` flag will remove
// other dependencies that were installed previously in the same manner (https://github.com/npm/cli/issues/1460).
// So we should workaround it passing all packages for install to only one npm install command
const EXPO_DEPS: PackageConfig[] = [xdlPackageConfig, metroConfigPackageConfig];

export const getXDLPackage: () => Promise<
    typeof XDLPackage
> = PackageLoader.getInstance().generateGetPackageFunction<typeof XDLPackage>(
    xdlPackageConfig,
    ...EXPO_DEPS,
);
export const getMetroConfigPackage: () => Promise<
    typeof MetroConfigPackage
> = PackageLoader.getInstance().generateGetPackageFunction<typeof MetroConfigPackage>(
    metroConfigPackageConfig,
    ...EXPO_DEPS,
);
export const getNgrokResolver: () => Promise<XDLPackage.ResolveNgrok> = PackageLoader.getInstance().generateGetPackageFunction<XDLPackage.ResolveNgrok>(
    ngrokPackageConfig,
    ...EXPO_DEPS,
);

export type IUser = XDLPackage.IUser;

export async function configReactNativeVersionWarnings(): Promise<void> {
    (await getXDLPackage()).Config.validation.reactNativeVersionWarnings = false;
}

export async function attachLoggerStream(
    rootPath: string,
    options?: XDLPackage.IBunyanStream | any,
): Promise<void> {
    (await getXDLPackage()).ProjectUtils.attachLoggerStream(rootPath, options);
}

export async function currentUser(): Promise<XDLPackage.IUser> {
    const xdl = await getXDLPackage();
    return await (xdl.User
        ? xdl.User.getCurrentUserAsync()
        : xdl.UserManager.getCurrentUserAsync());
}

export async function login(username: string, password: string): Promise<XDLPackage.IUser> {
    const xdl = await getXDLPackage();
    return await (xdl.User
        ? xdl.User.loginAsync("user-pass", { username, password })
        : xdl.UserManager.loginAsync("user-pass", {
              username,
              password,
          }));
}

export async function getExpoSdkVersions(): Promise<XDLPackage.SDKVersions> {
    return (await getXDLPackage()).Versions.sdkVersionsAsync();
}

export async function getReleasedExpoSdkVersions(): Promise<XDLPackage.SDKVersions> {
    return (await getXDLPackage()).Versions.releasedSdkVersionsAsync();
}

export async function publish(
    projectRoot: string,
    options?: XDLPackage.IPublishOptions,
): Promise<XDLPackage.IPublishResponse> {
    return (await getXDLPackage()).Project.publishAsync(projectRoot, options);
}

export async function setOptions(projectRoot: string, options: XDLPackage.IOptions): Promise<void> {
    await (await getXDLPackage()).ProjectSettings.setPackagerInfoAsync(projectRoot, options);
}

export async function startExponentServer(projectRoot: string): Promise<void> {
    await (await getXDLPackage()).Project.startExpoServerAsync(projectRoot);
}

export async function startTunnels(projectRoot: string): Promise<void> {
    await (await getXDLPackage()).Project.startTunnelsAsync(projectRoot);
}

export async function getUrl(
    projectRoot: string,
    options?: XDLPackage.IUrlOptions,
): Promise<string> {
    return (await getXDLPackage()).UrlUtils.constructManifestUrlAsync(projectRoot, options);
}

export async function stopAll(projectRoot: string): Promise<void> {
    await (await getXDLPackage()).Project.stopAsync(projectRoot);
}

export async function startAdbReverse(projectRoot: string): Promise<boolean> {
    return (await getXDLPackage()).Android.startAdbReverseAsync(projectRoot);
}

export async function stopAdbReverse(projectRoot: string): Promise<void> {
    await (await getXDLPackage()).Android.stopAdbReverseAsync(projectRoot);
}

export async function getMetroConfig(
    projectRoot: string,
): Promise<MetroConfigPackage.IMetroConfig> {
    return (await getMetroConfigPackage()).loadAsync(projectRoot);
}

export async function isNgrokInstalled(projectRoot: string): Promise<boolean> {
    const ngrokResolver = await getNgrokResolver();
    try {
        const ngrok = await ngrokResolver.resolveNgrokAsync(projectRoot, {
            shouldPrompt: false,
            autoInstall: false,
        });
        return !!ngrok;
    } catch (err) {
        // If unsupported version of the "@expo/ngrok" package was detected, we need to update the package.
        // Since the "require" method used to parse the "ngrok⁄package.json" file in the "xdl" package caches
        // all processed modules, we have to remove this file from cache to be able to require a new version
        // of that file after the update of the "@expo/ngrok" package
        removeModuleFromRequireCacheByName(pathJoin("ngrok", "package.json"));
        throw err;
    }
}
