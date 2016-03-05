// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.

import * as path from "path";

/**
 * Interface defining the host (desktop) platform specific operations.
 */
export interface IHostPlatform {
    getUserHomePath(): string;
    getSetEnvCommand(): string;
    getSettingsHome(): string;
    getNpmCommand(): string;
    getReactNativeCommand(): string;
    getExtensionPipePath(): string;
    getPlatformId(): HostPlatformId;
}

/**
 * Defines the identifiers of all the platforms we support.
 */
export enum HostPlatformId {
    WINDOWS,
    OSX,
    LINUX
}

/**
 * IHostPlatform implemenation for the Windows platform.
 */
class WindowsHostPlatform implements IHostPlatform {
    public getUserHomePath(): string {
        return process.env.USERPROFILE;
    }

    public getSetEnvCommand(): string {
        return "setx VSCODE_TSJS 1";
    }

    public getReactNativeCommand() {
        return "react-native.cmd";
    }

    public getSettingsHome(): string {
        return path.join(process.env.APPDATA, "vscode-react-native");
    }

    public getNpmCommand(): string {
        return "npm.cmd";
    }

    public getExtensionPipePath(): string {
        return "\\\\?\\pipe\\vscodereactnative";
    }

    public getPlatformId(): HostPlatformId {
        return HostPlatformId.WINDOWS;
    }
}

/**
 * IHostPlatform implemenation for the OSX platform.
 */
class OSXHostPlatform implements IHostPlatform {
    public getUserHomePath(): string {
        return process.env.HOME;
    }

    public getSetEnvCommand(): string {
        return "launchctl setenv VSCODE_TSJS 1";
    }

    public getReactNativeCommand() {
        return "react-native";
    }

    public getSettingsHome(): string {
        return path.join(process.env.HOME, ".vscode-react-native");
    }

    public getNpmCommand(): string {
        return "npm";
    }

    public getExtensionPipePath(): string {
        return "/tmp/vscodereactnative.sock";
    }

    public getPlatformId(): HostPlatformId {
        return HostPlatformId.OSX;
    }
}

/**
 * Resolves the host platform.
 */
export class HostPlatformResolver {

    private static WinPlatformInstance = new WindowsHostPlatform();
    private static OSXPlatformInstance = new OSXHostPlatform();

    /**
     * Resolves the dev machine, desktop platform.
     */
    public static getHostPlatform(): IHostPlatform {
        let platform = process.platform;
        switch (platform) {
            case "win32":
                return HostPlatformResolver.WinPlatformInstance;
            case "darwin":
            default:
                return HostPlatformResolver.OSXPlatformInstance;
        }
    }
}
