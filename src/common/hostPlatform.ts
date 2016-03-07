// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.

import * as child_process from "child_process";
import {Node} from "./node/node";
import * as path from "path";
import * as Q from "q";

/**
 * Interface defining the host (desktop) platform specific operations.
 */
export interface IHostPlatform {
    getUserHomePath(): string;
    getSettingsHome(): string;
    getNpmCommand(): string;
    getReactNativeCommand(): string;
    getExtensionPipePath(): string;
    getPlatformId(): HostPlatformId;
    killProcess(process: child_process.ChildProcess): Q.Promise<void>;
    setEnvironmentVariable(name: string, value: string): Q.Promise<void>;
}

/**
 * Defines the identifiers of all the platforms we support.
 */
export enum HostPlatformId {
    WINDOWS,
    OSX
}

/**
 * IHostPlatform implemenation for the Windows platform.
 */
class WindowsHostPlatform implements IHostPlatform {
    public getUserHomePath(): string {
        return process.env.USERPROFILE;
    }

    public setEnvironmentVariable(name: string, value: string): Q.Promise<any> {
        return Q.nfcall(child_process.exec, `setx ${name} ${value}`);
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

    public killProcess(process: child_process.ChildProcess): Q.Promise<void> {
        return new Node.ChildProcess().exec("taskkill /pid " + process.pid + " /T /F").outcome.then(() => {
            return Q.resolve<void>(void 0);
        });
    }
}

/**
 * IHostPlatform implemenation for the OSX platform.
 */
class OSXHostPlatform implements IHostPlatform {
    public getUserHomePath(): string {
        return process.env.HOME;
    }

    public setEnvironmentVariable(name: string, value: string): Q.Promise<any> {
        return Q.nfcall(child_process.exec, `launchctl setenv ${name} ${value}`);
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

    public killProcess(process: child_process.ChildProcess): Q.Promise<void> {
        process.kill();
        return Q.resolve<void>(void 0);
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
