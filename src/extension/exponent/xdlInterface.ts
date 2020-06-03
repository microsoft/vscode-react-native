// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.

import {CommandExecutor, CommandVerbosity} from "../../common/commandExecutor";
import {HostPlatform} from "../../common/hostPlatform";
import {OutputChannelLogger} from "../log/OutputChannelLogger";

import * as XDLPackage from "xdl";
import * as path from "path";
import * as Q from "q";

const logger: OutputChannelLogger = OutputChannelLogger.getMainChannel();

const XDL_PACKAGE = "@expo/xdl";
const EXPO_DEPS: string[] = [
    XDL_PACKAGE,
    "@expo/ngrok", // devDependencies for xdl
];

let xdlPackage: Q.Promise<typeof XDLPackage>;

function getPackage(): Q.Promise<typeof XDLPackage> {
    if (xdlPackage) {
        return xdlPackage;
    }
    // Don't do the require if we don't actually need it
    try {
        logger.debug("Getting exponent dependency.");
        const xdl = require(XDL_PACKAGE);
        xdlPackage = Q(xdl);
        return xdlPackage;
    } catch (e) {
        if (e.code === "MODULE_NOT_FOUND") {
            logger.debug("Dependency not present. Installing it...");
        } else {
            throw e;
        }
    }
    let commandExecutor = new CommandExecutor(path.dirname(path.join(__dirname, "..", "..", "..")), logger);
    xdlPackage = commandExecutor.spawnWithProgress(HostPlatform.getNpmCliCommand("npm"),
        ["install", ...EXPO_DEPS, "--verbose", "--no-save"],
        { verbosity: CommandVerbosity.PROGRESS })
        .then((): typeof XDLPackage => {
            return require(XDL_PACKAGE);
        });
    return xdlPackage;
}

export type IUser = XDLPackage.IUser;

export function configReactNativeVersionWargnings(): Q.Promise<void> {
    return getPackage()
        .then((xdl) => {
            xdl.Config.validation.reactNativeVersionWarnings = false;
        });
}

export function attachLoggerStream(rootPath: string, options?: XDLPackage.IBunyanStream | any): Q.Promise<void> {
    return getPackage()
        .then((xdl) =>
            xdl.ProjectUtils.attachLoggerStream(rootPath, options));
}

export function supportedVersions(): Q.Promise<string[]> {
    return getPackage()
        .then((xdl) =>
            xdl.Versions.facebookReactNativeVersionsAsync());
}

export function currentUser(): Q.Promise<XDLPackage.IUser> {
    return getPackage()
        .then((xdl) =>
            xdl.User ? xdl.User.getCurrentUserAsync() : xdl.UserManager.getCurrentUserAsync());
}

export function login(username: string, password: string): Q.Promise<XDLPackage.IUser> {
    return getPackage()
        .then((xdl) =>
        xdl.User ? xdl.User.loginAsync("user-pass", { username: username, password: password }) : xdl.UserManager.loginAsync("user-pass", { username: username, password: password }));
}

export function mapVersion(reactNativeVersion: string): Q.Promise<string> {
    return getPackage()
        .then((xdl) =>
            xdl.Versions.facebookReactNativeVersionToExpoVersionAsync(reactNativeVersion));
}

export function publish(projectRoot: string, options?: XDLPackage.IPublishOptions): Q.Promise<XDLPackage.IPublishResponse> {
    return getPackage()
        .then((xdl) =>
            xdl.Project.publishAsync(projectRoot, options));
}

export function setOptions(projectRoot: string, options?: XDLPackage.IOptions): Q.Promise<void> {
    return getPackage()
        .then((xdl) =>
            xdl.Project.setOptionsAsync(projectRoot, options));
}

export function startExponentServer(projectRoot: string): Q.Promise<void> {
    return getPackage()
        .then((xdl) =>
            xdl.Project.startExpoServerAsync(projectRoot));
}

export function startTunnels(projectRoot: string): Q.Promise<void> {
    return getPackage()
        .then((xdl) =>
            xdl.Project.startTunnelsAsync(projectRoot));
}

export function getUrl(projectRoot: string, options?: XDLPackage.IUrlOptions): Q.Promise<string> {
    return getPackage()
        .then((xdl) =>
            xdl.Project.getUrlAsync(projectRoot, options));
}

export function stopAll(projectRoot: string): Q.Promise<void> {
    return getPackage()
        .then((xdl) =>
            xdl.Project.stopAsync(projectRoot));
}

export function startAdbReverse(projectRoot: string): Q.Promise<boolean> {
    return getPackage()
        .then((xdl) =>
            xdl.Android.startAdbReverseAsync(projectRoot));
}

export function stopAdbReverse(projectRoot: string): Q.Promise<void> {
    return getPackage()
        .then((xdl) =>
            xdl.Android.stopAdbReverseAsync(projectRoot));
}
