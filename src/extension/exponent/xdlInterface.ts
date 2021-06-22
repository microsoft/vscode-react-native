// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.

import * as XDLPackage from "xdl";
import * as MetroConfigPackage from "metro-config";
import { PackageLoader, PackageConfig } from "../../common/packageLoader";
import { SettingsHelper } from "../settingsHelper";

const XDL_PACKAGE = "xdl";
const METRO_CONFIG_PACKAGE = "@expo/metro-config";
const xdlVersion = SettingsHelper.getExpoDependencyVersion(XDL_PACKAGE);

const xdlPackageUserFileConfig = new PackageConfig(XDL_PACKAGE, xdlVersion, "build/User");
const xdlPackageVersionsFileConfig = new PackageConfig(XDL_PACKAGE, xdlVersion, "build/Versions");
const xdlPackageProjectFileConfig = new PackageConfig(XDL_PACKAGE, xdlVersion, "build/Project");
const xdlPackageUrlUtilsFileConfig = new PackageConfig(XDL_PACKAGE, xdlVersion, "build/UrlUtils");
const xdlPackageAndroidFileConfig = new PackageConfig(XDL_PACKAGE, xdlVersion, "build/Android");
const ngrokPackageConfig = new PackageConfig(XDL_PACKAGE, xdlVersion, "build/start/resolveNgrok");
const xdlPackageProjectUtilsFileConfig = new PackageConfig(
    XDL_PACKAGE,
    xdlVersion,
    "build/project/ProjectUtils",
);
const metroConfigPackageConfig = new PackageConfig(
    METRO_CONFIG_PACKAGE,
    SettingsHelper.getExpoDependencyVersion("metroConfig"),
);

// There is the problem with '--no-save' flag for 'npm install' command for npm v6.
// Installing npm dependencies with the `--no-save` flag will remove
// other dependencies that were installed previously in the same manner (https://github.com/npm/cli/issues/1460).
// So we should workaround it passing all packages for install to only one npm install command
const EXPO_DEPS: PackageConfig[] = [ngrokPackageConfig, metroConfigPackageConfig];

export const getProjectUtilsPackage: () => Promise<XDLPackage.IProjectUtils> = PackageLoader.getInstance().generateGetPackageFunction<XDLPackage.IProjectUtils>(
    xdlPackageProjectUtilsFileConfig,
    ...EXPO_DEPS,
);
export const getUserPackage: () => Promise<XDLPackage.IUserManager> = PackageLoader.getInstance().generateGetPackageFunction<XDLPackage.IUserManager>(
    xdlPackageUserFileConfig,
    ...EXPO_DEPS,
);
export const getVersionsPackage: () => Promise<XDLPackage.IVersions> = PackageLoader.getInstance().generateGetPackageFunction<XDLPackage.IVersions>(
    xdlPackageVersionsFileConfig,
    ...EXPO_DEPS,
);
export const getProjectPackage: () => Promise<XDLPackage.IProject> = PackageLoader.getInstance().generateGetPackageFunction<XDLPackage.IProject>(
    xdlPackageProjectFileConfig,
    ...EXPO_DEPS,
);
export const getUrlUtilsPackage: () => Promise<XDLPackage.IUrlUtils> = PackageLoader.getInstance().generateGetPackageFunction<XDLPackage.IUrlUtils>(
    xdlPackageUrlUtilsFileConfig,
    ...EXPO_DEPS,
);
export const getAndroidPackage: () => Promise<XDLPackage.IAndroid> = PackageLoader.getInstance().generateGetPackageFunction<XDLPackage.IAndroid>(
    xdlPackageAndroidFileConfig,
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

export function attachLoggerStream(
    rootPath: string,
    options?: XDLPackage.IBunyanStream | any,
): Promise<void> {
    return getProjectUtilsPackage().then(projectUtils =>
        projectUtils.attachLoggerStream(rootPath, options),
    );
}

export function currentUser(): Promise<XDLPackage.IUser> {
    return getUserPackage().then(userManager => {
        return userManager.default.getCurrentUserAsync();
    });
}

export function login(username: string, password: string): Promise<XDLPackage.IUser> {
    return getUserPackage().then(userManager =>
        userManager.default.loginAsync("user-pass", {
            username: username,
            password: password,
        }),
    );
}

export function getExpoSdkVersions(): Promise<XDLPackage.SDKVersions> {
    return getVersionsPackage().then(versions => versions.sdkVersionsAsync());
}

export function getReleasedExpoSdkVersions(): Promise<XDLPackage.SDKVersions> {
    return getVersionsPackage().then(versions => versions.releasedSdkVersionsAsync());
}

export function publish(
    projectRoot: string,
    options?: XDLPackage.IPublishOptions,
): Promise<XDLPackage.IPublishResponse> {
    return getProjectPackage().then(project => project.publishAsync(projectRoot, options));
}

export function setOptions(projectRoot: string, options?: XDLPackage.IOptions): Promise<void> {
    return getProjectPackage().then(project => project.setOptionsAsync(projectRoot, options));
}

export function startExponentServer(projectRoot: string): Promise<void> {
    return getProjectPackage().then(project => project.startExpoServerAsync(projectRoot));
}

export function startTunnels(projectRoot: string): Promise<void> {
    return getProjectPackage().then(project => project.startTunnelsAsync(projectRoot));
}

export function getUrl(projectRoot: string, options?: XDLPackage.IUrlOptions): Promise<string> {
    return getUrlUtilsPackage().then(urlUtils =>
        urlUtils.constructManifestUrlAsync(projectRoot, options),
    );
}

export function stopAll(projectRoot: string): Promise<void> {
    return getProjectPackage().then(project => project.stopAsync(projectRoot));
}

export function startAdbReverse(projectRoot: string): Promise<boolean> {
    return getAndroidPackage().then(android => android.startAdbReverseAsync(projectRoot));
}

export function stopAdbReverse(projectRoot: string): Promise<void> {
    return getAndroidPackage().then(android => android.stopAdbReverseAsync(projectRoot));
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
        .then(ngrok => !!ngrok);
}
