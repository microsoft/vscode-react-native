// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.

import {CommandExecutor, CommandVerbosity} from "../commandExecutor";
import {Log} from "../log/log";

import * as XDLPackage from "xdl";
import * as Q from "q";

const XDL_VERSION = "0.12.0";
let xdlPackage: typeof XDLPackage;

function getPackage(): Q.Promise<typeof XDLPackage> {
    if (xdlPackage) {
        return Q(xdlPackage);
    }
    // Don't do the require if we don't actually need it
    try {
        Log.logMessage("Getting exponent dependecy.", false);
        xdlPackage = require("xdl");
        return Q(xdlPackage);
    } catch(e) {
        // Ignore if not found
    }
    let commandExecutor = new CommandExecutor();
    Log.logMessage("Depencendy not present. Installing it...", false);
    return commandExecutor.spawnWithProgress("npm", ["install", `xdl@${XDL_VERSION}`, "--verbose"], { verbosity: CommandVerbosity.PROGRESS })
        .then(() => {
            xdlPackage = require("xdl");
            return xdlPackage;
        });
}

export type IUser = XDLPackage.IUser;

export function configReactNativeVersionWargnings(): Q.Promise<void> {
    return getPackage()
        .then((xdl) => {
            xdl.Config.validation.reactNativeVersionWarnings = false;
        });
}

export function attachLoggerStream(rootPath: string, options?: XDLPackage.IBunyanStream): Q.Promise<void> {
    return getPackage()
        .then((xdl) =>
            xdl.ProjectUtils.attachLoggerStream(rootPath, options));
}

export function supportedVersions(): Q.Promise<Array<string>> {
    return getPackage()
        .then((xdl) =>
            xdl.Versions.facebookReactNativeVersionsAsync());
}

export function currentUser(): Q.Promise<XDLPackage.IUser> {
    return getPackage()
        .then((xdl) =>
            xdl.User.getCurrentUserAsync());
}

export function login(username: string, password: string): Q.Promise<XDLPackage.IUser> {
    return getPackage()
        .then((xdl) =>
            xdl.User.loginAsync({ username: username, password: password }));
}

export function mapVersion(reactNativeVersion: string): Q.Promise<string> {
    return getPackage()
        .then((xdl) =>
            xdl.Versions.facebookReactNativeVersionToExponentVersionAsync(reactNativeVersion));
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
            xdl.Project.startExponentServerAsync(projectRoot));
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
