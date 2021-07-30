// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.

import { ChildProcess } from "./node/childProcess";
import { TargetPlatformId } from "./targetPlatformHelper";
import * as path from "path";

/**
 * Interface defining the host (desktop) platform specific operations.
 */
interface IHostPlatform {
    getUserHomePath(): string;
    getSettingsHome(): string;
    getNpmCliCommand(packageName: string): string;
    getPlatformId(): HostPlatformId;
    setEnvironmentVariable(name: string, value: string): Promise<void>;
    getUserID(): string;
    isCompatibleWithTarget(targetPlatformId: TargetPlatformId): boolean;
}

/**
 * Defines the identifiers of all the platforms we support.
 */
export enum HostPlatformId {
    WINDOWS,
    OSX,
    LINUX,
}

/**
 * IHostPlatform implemenation for the Windows platform.
 */
class WindowsHostPlatform implements IHostPlatform {
    public getUserHomePath(): string {
        return process.env.USERPROFILE || "";
    }

    public async setEnvironmentVariable(name: string, value: string): Promise<any> {
        const res = await new ChildProcess().exec(`setx ${name} ${value}`);
        return res.outcome;
    }

    public getSettingsHome(): string {
        return path.join(process.env.APPDATA || "", "vscode-react-native");
    }

    public getNpmCliCommand(cliName: string): string {
        return `${cliName}.cmd`;
    }

    public getPlatformId(): HostPlatformId {
        return HostPlatformId.WINDOWS;
    }

    public getUserID(): string {
        return process.env.USERNAME || "";
    }

    public isCompatibleWithTarget(targetPlatformId: TargetPlatformId): boolean {
        switch (targetPlatformId) {
            case TargetPlatformId.ANDROID:
            case TargetPlatformId.EXPONENT:
            case TargetPlatformId.WINDOWS:
                return true;
            default:
                return false;
        }
    }
}

abstract class UnixHostPlatform implements IHostPlatform {
    public getUserHomePath(): string {
        return process.env.HOME || "";
    }

    public abstract setEnvironmentVariable(name: string, value: string): Promise<any>;

    public getSettingsHome(): string {
        return path.join(process.env.HOME || "", ".vscode-react-native");
    }

    public getNpmCliCommand(packageName: string): string {
        return packageName;
    }

    public abstract getPlatformId(): HostPlatformId;

    public abstract getUserID(): string;

    public abstract isCompatibleWithTarget(targetPlatformId: TargetPlatformId): boolean;
}

/**
 * IHostPlatform implemenation for the OSX platform.
 */
class OSXHostPlatform extends UnixHostPlatform {
    public async setEnvironmentVariable(name: string, value: string): Promise<any> {
        const res = await new ChildProcess().exec(`launchctl setenv ${name} ${value}`);
        return res.outcome;
    }

    public getPlatformId(): HostPlatformId {
        return HostPlatformId.OSX;
    }

    public getUserID(): string {
        return process.env.LOGNAME || "";
    }

    public isCompatibleWithTarget(targetPlatformId: TargetPlatformId): boolean {
        switch (targetPlatformId) {
            case TargetPlatformId.ANDROID:
            case TargetPlatformId.EXPONENT:
            case TargetPlatformId.IOS:
            case TargetPlatformId.MACOS:
                return true;
            default:
                return false;
        }
    }
}

/**
 * IHostPlatform implemenation for the Linux platform.
 */
class LinuxHostPlatform extends UnixHostPlatform {
    public async setEnvironmentVariable(name: string, value: string): Promise<any> {
        const res = await new ChildProcess().exec(`export ${name}=${value}`);
        return res.outcome;
    }

    public getPlatformId(): HostPlatformId {
        return HostPlatformId.LINUX;
    }

    public getUserID(): string {
        return process.env.USER || "";
    }

    public isCompatibleWithTarget(targetPlatformId: TargetPlatformId): boolean {
        switch (targetPlatformId) {
            case TargetPlatformId.ANDROID:
            case TargetPlatformId.EXPONENT:
                return true;
            default:
                return false;
        }
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

    public static getPlatformId(): HostPlatformId {
        return HostPlatform.platform.getPlatformId();
    }

    public static setEnvironmentVariable(name: string, value: string): Promise<void> {
        return HostPlatform.platform.setEnvironmentVariable(name, value);
    }

    /* Returns a value that is unique for each user of this computer */
    public static getUserID(): string {
        return HostPlatform.platform.getUserID();
    }

    public static isCompatibleWithTarget(targetPlatformId: TargetPlatformId): boolean {
        return HostPlatform.platform.isCompatibleWithTarget(targetPlatformId);
    }
}
