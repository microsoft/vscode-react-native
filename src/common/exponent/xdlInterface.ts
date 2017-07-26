// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.

/// <reference path="./xdlInterface.d.ts" />

import {CommandExecutor, CommandVerbosity} from "../commandExecutor";
import {HostPlatform} from "../hostPlatform";
import {Log} from "../log/log";

import * as path from "path";
import * as Q from "q";
import * as XDLPackage from "XDLPackage";


const EXPO_DEPS: string[] = [
    "xdl",
    "@expo/ngrok", // devDependencies for xdl
];

let xdlPackage: Q.Promise<any>; // TODO something with XDLPackage type

function getPackage(): Q.Promise<any> {
    if (xdlPackage) {
        return xdlPackage;
    }
    // Don't do the require if we don't actually need it
    try {
        Log.logMessage("Getting exponent dependecy.", false);
        const xdl = require("xdl");
        xdlPackage = Q(xdl);
        return xdlPackage;
    } catch (e) {
        if (e.code === "MODULE_NOT_FOUND") {
            Log.logMessage("Dependency not present. Installing it...", false);
        } else {
            throw e;
        }
    }
    let commandExecutor = new CommandExecutor();
    xdlPackage = commandExecutor.spawnWithProgress(HostPlatform.getNpmCliCommand("npm"),
        ["install", EXPO_DEPS.join(" "), "--verbose"],
        { verbosity: CommandVerbosity.PROGRESS,
          cwd: path.dirname(require.resolve("../../../../"))})
        .then(() => {
            return require("xdl");
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
            xdl.User.getCurrentUserAsync());
}

export function login(username: string, password: string): Q.Promise<XDLPackage.IUser> {
    return getPackage()
        .then((xdl) =>
            xdl.User.loginAsync("user-pass", { username: username, password: password }));
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
