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

export function configReactNativeVersionWarnings(): Promise<void> {
    return getXDLPackage().then(xdl => {
        xdl.Config.validation.reactNativeVersionWarnings = false;
    });
}

export function attachLoggerStream(
    rootPath: string,
    options?: XDLPackage.IBunyanStream | any,
): Promise<void> {
    return getXDLPackage().then(xdl => xdl.ProjectUtils.attachLoggerStream(rootPath, options));
}

export function currentUser(): Promise<XDLPackage.IUser> {
    return getXDLPackage().then(xdl =>
        xdl.User ? xdl.User.getCurrentUserAsync() : xdl.UserManager.getCurrentUserAsync(),
    );
}

export function login(username: string, password: string): Promise<XDLPackage.IUser> {
    return getXDLPackage().then(xdl =>
        xdl.User
            ? xdl.User.loginAsync("user-pass", { username: username, password: password })
            : xdl.UserManager.loginAsync("user-pass", {
                  username: username,
                  password: password,
              }),
    );
}

export function getExpoSdkVersions(): Promise<XDLPackage.SDKVersions> {
    return getXDLPackage().then(xdl => xdl.Versions.sdkVersionsAsync());
}

export function getReleasedExpoSdkVersions(): Promise<XDLPackage.SDKVersions> {
    return getXDLPackage().then(xdl => xdl.Versions.releasedSdkVersionsAsync());
}

export function publish(
    projectRoot: string,
    options?: XDLPackage.IPublishOptions,
): Promise<XDLPackage.IPublishResponse> {
    return getXDLPackage().then(xdl => xdl.Project.publishAsync(projectRoot, options));
}

export function setOptions(projectRoot: string, options?: XDLPackage.IOptions): Promise<void> {
    return getXDLPackage().then(xdl => xdl.Project.setOptionsAsync(projectRoot, options));
}

export function startExponentServer(projectRoot: string): Promise<void> {
    return getXDLPackage().then(xdl => xdl.Project.startExpoServerAsync(projectRoot));
}

export function startTunnels(projectRoot: string): Promise<void> {
    return getXDLPackage().then(xdl => xdl.Project.startTunnelsAsync(projectRoot));
}

export function getUrl(projectRoot: string, options?: XDLPackage.IUrlOptions): Promise<string> {
    return getXDLPackage().then(xdl =>
        xdl.UrlUtils.constructManifestUrlAsync(projectRoot, options),
    );
}

export function stopAll(projectRoot: string): Promise<void> {
    return getXDLPackage().then(xdl => xdl.Project.stopAsync(projectRoot));
}

export function startAdbReverse(projectRoot: string): Promise<boolean> {
    return getXDLPackage().then(xdl => xdl.Android.startAdbReverseAsync(projectRoot));
}

export function stopAdbReverse(projectRoot: string): Promise<void> {
    return getXDLPackage().then(xdl => xdl.Android.stopAdbReverseAsync(projectRoot));
}

export function getMetroConfig(projectRoot: string): Promise<MetroConfigPackage.IMetroConfig> {
    return getMetroConfigPackage().then(metroConfigPackage =>
        metroConfigPackage.loadAsync(projectRoot),
    );
}

export function isNgrokInstalled(projectRoot: string): Promise<boolean> {
    return getNgrokResolver()
        .then(ngrokResolver =>
            ngrokResolver.resolveNgrokAsync(projectRoot, {
                shouldPrompt: false,
                autoInstall: false,
            }),
        )
        .then(ngrok => !!ngrok)
        .catch(err => {
            // If unsupported version of the "@expo/ngrok" package was detected, we need to update the package.
            // Since the "require" method used to parse the "ngrok⁄package.json" file in the "xdl" package caches
            // all processed modules, we have to remove this file from cache to be able to require a new version
            // of that file after the update of the "@expo/ngrok" package
            removeModuleFromRequireCacheByName(pathJoin("ngrok", "package.json"));
            throw err;
        });
}
