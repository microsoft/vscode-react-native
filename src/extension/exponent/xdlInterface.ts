// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.

import { CommandExecutor, CommandVerbosity } from "../../common/commandExecutor";
import { HostPlatform } from "../../common/hostPlatform";
import { OutputChannelLogger } from "../log/OutputChannelLogger";

import * as XDLPackage from "xdl";
import * as MetroConfigPackage from "metro-config";
import * as path from "path";
import { findFileInFolderHierarchy } from "../../common/extensionHelper";
import customRequire from "../../common/customRequire";

const logger: OutputChannelLogger = OutputChannelLogger.getMainChannel();

const XDL_PACKAGE = "@expo/xdl";
const METRO_CONFIG_PACKAGE = "@expo/metro-config";
const NGROK_PACKAGE = "@expo/ngrok";

let getXDLPackage: () => Promise<typeof XDLPackage> = generateGetPackageFunction<typeof XDLPackage>(
    XDL_PACKAGE,
    NGROK_PACKAGE,
);
let getMetroConfigPackage: () => Promise<typeof MetroConfigPackage> = generateGetPackageFunction<
    typeof MetroConfigPackage
>(METRO_CONFIG_PACKAGE);

async function installPackages(
    packageName: string,
    ...additionalDependencies: string[]
): Promise<void> {
    let commandExecutor = new CommandExecutor(
        path.dirname(findFileInFolderHierarchy(__dirname, "package.json") || __dirname),
        logger,
    );
    return commandExecutor.spawnWithProgress(
        HostPlatform.getNpmCliCommand("npm"),
        ["install", packageName, ...additionalDependencies, "--verbose", "--no-save"],
        { verbosity: CommandVerbosity.PROGRESS },
    );
}

async function loadPackage<T>(
    packageName: string,
    ...additionalDependencies: string[]
): Promise<T> {
    try {
        logger.debug("Getting exponent dependency.");
        const module = customRequire(packageName);
        return Promise.resolve(module);
    } catch (e) {
        if (e.code === "MODULE_NOT_FOUND") {
            logger.debug("Dependency not present. Installing it...");
        } else {
            throw e;
        }
    }
    return installPackages(packageName, ...additionalDependencies).then(
        (): T => {
            return customRequire(packageName);
        },
    );
}

function generateGetPackageFunction<T>(
    packageName: string,
    ...additionalDependencies: string[]
): () => Promise<T> {
    let promise: Promise<T>;
    return (): Promise<T> => {
        // Using the promise saved in lexical environment to prevent module reloading
        if (promise) {
            return promise;
        } else {
            promise = loadPackage<T>(packageName, ...additionalDependencies);
            return promise;
        }
    };
}

export type IUser = XDLPackage.IUser;

export function configReactNativeVersionWargnings(): Promise<void> {
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

export function supportedVersions(): Promise<string[]> {
    return getXDLPackage().then(xdl => xdl.Versions.facebookReactNativeVersionsAsync());
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
            : xdl.UserManager.loginAsync("user-pass", { username: username, password: password }),
    );
}

export function mapVersion(reactNativeVersion: string): Promise<string> {
    return getXDLPackage().then(xdl =>
        xdl.Versions.facebookReactNativeVersionToExpoVersionAsync(reactNativeVersion),
    );
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
