// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.

import {ChildProcess} from "./node/childProcess";
import * as path from "path";
import * as Q from "q";

/**
 * Interface defining the host (desktop) platform specific operations.
 */
interface IHostPlatform {
    getUserHomePath(): string;
    getSettingsHome(): string;
    getNpmCliCommand(packageName: string): string;
    getExtensionPipePath(): string;
    getPlatformId(): HostPlatformId;
    setEnvironmentVariable(name: string, value: string): Q.Promise<void>;
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

    public setEnvironmentVariable(name: string, value: string): Q.Promise<any> {
        return new ChildProcess().exec(`setx ${name} ${value}`).outcome;
    }

    public getSettingsHome(): string {
        return path.join(process.env.APPDATA, "vscode-react-native");
    }

    public getNpmCliCommand(cliName: string): string {
        return `${cliName}.cmd`;
    }

    public getExtensionPipePath(): string {
        return "\\\\?\\pipe\\vscodereactnative";
    }

    public getPlatformId(): HostPlatformId {
        return HostPlatformId.WINDOWS;
    }
}

abstract class UnixHostPlatform implements IHostPlatform {
    public getUserHomePath(): string {
        return process.env.HOME;
    }

    public abstract setEnvironmentVariable(name: string, value: string): Q.Promise<any>;

    public getSettingsHome(): string {
        return path.join(process.env.HOME, ".vscode-react-native");
    }

    public getNpmCliCommand(packageName: string): string {
        return packageName;
    }

    public getExtensionPipePath(): string {
        return "/tmp/vscodereactnative.sock";
    }

    public abstract getPlatformId(): HostPlatformId;
}

/**
 * IHostPlatform implemenation for the OSX platform.
 */
class OSXHostPlatform extends UnixHostPlatform {
    public setEnvironmentVariable(name: string, value: string): Q.Promise<any> {
        return new ChildProcess().exec(`launchctl setenv ${name} ${value}`).outcome;
    }

    public getPlatformId(): HostPlatformId {
        return HostPlatformId.OSX;
    }
}

/**
 * IHostPlatform implemenation for the Linux platform.
 */
class LinuxHostPlatform extends UnixHostPlatform {
    public setEnvironmentVariable(name: string, value: string): Q.Promise<any> {
        return new ChildProcess().exec(`export ${name}=${value}`).outcome;
    }

    public getPlatformId(): HostPlatformId {
        return HostPlatformId.LINUX;
    }
}

/**
 * Allows platform specific operations based on the user's OS.
 */
export class HostPlatform {

    private static platformInstance: IHostPlatform;

    /**
     * Resolves the dev machine, desktop platform.
     */
    private static get platform(): IHostPlatform {
        if (!HostPlatform.platformInstance) {
            switch (process.platform) {
                case "win32":
                    HostPlatform.platformInstance = new WindowsHostPlatform();
                    break;
                case "darwin":
                    HostPlatform.platformInstance = new OSXHostPlatform();
                    break;
                case "linux":
                    HostPlatform.platformInstance = new LinuxHostPlatform();
                    break;
                default:
                    HostPlatform.platformInstance = new LinuxHostPlatform();
                    break;
            }
        }

        return HostPlatform.platformInstance;
    }

    public static getUserHomePath(): string {
        return HostPlatform.platform.getUserHomePath();
    }

    public static getSettingsHome(): string {
        return HostPlatform.platform.getSettingsHome();
    }

    public static getNpmCliCommand(packageName: string): string {
        return HostPlatform.platform.getNpmCliCommand(packageName);
    }

    public static getExtensionPipePath(): string {
        return HostPlatform.platform.getExtensionPipePath();
    }

    public static getPlatformId(): HostPlatformId {
        return HostPlatform.platform.getPlatformId();
    }

    public static setEnvironmentVariable(name: string, value: string): Q.Promise<void> {
        return HostPlatform.platform.setEnvironmentVariable(name, value);
    }
}
