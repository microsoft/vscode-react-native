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
    getCommand(packageName: string): string;
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
        return Q.nfcall(child_process.exec, `setx ${name} ${value}`);
    }

    public getSettingsHome(): string {
        return path.join(process.env.APPDATA, "vscode-react-native");
    }

    public getCommand(packageName: string): string {
        return `${packageName}.cmd`;
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

abstract class UnixHostPlatform implements IHostPlatform {
    public getUserHomePath(): string {
        return process.env.HOME;
    }

    public abstract setEnvironmentVariable(name: string, value: string): Q.Promise<any>;

    public getSettingsHome(): string {
        return path.join(process.env.HOME, ".vscode-react-native");
    }

    public getCommand(packageName: string): string {
        return packageName;
    }

    public getExtensionPipePath(): string {
        return "/tmp/vscodereactnative.sock";
    }

    public abstract getPlatformId(): HostPlatformId;

    public killProcess(process: child_process.ChildProcess): Q.Promise<void> {
        process.kill();
        return Q.resolve<void>(void 0);
    }
}

/**
 * IHostPlatform implemenation for the OSX platform.
 */
class OSXHostPlatform extends UnixHostPlatform {
    public setEnvironmentVariable(name: string, value: string): Q.Promise<any> {
        return Q.nfcall(child_process.exec, `launchctl setenv ${name} ${value}`);
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
        return Q.nfcall(child_process.exec, `export ${name}=${value}`);
    }

    public getPlatformId(): HostPlatformId {
        return HostPlatformId.LINUX;
    }
}

/**
 * Resolves the host platform.
 */
export class HostPlatformResolver {

    private static WinPlatformInstance = new WindowsHostPlatform();
    private static OSXPlatformInstance = new OSXHostPlatform();
    private static LinuxPlatformInstance = new LinuxHostPlatform();

    /**
     * Resolves the dev machine, desktop platform.
     */
    public static getHostPlatform(): IHostPlatform {
        let platform = process.platform;
        switch (platform) {
            case "win32":
                return HostPlatformResolver.WinPlatformInstance;
            case "darwin":
                return HostPlatformResolver.OSXPlatformInstance;
            case "linux":
            default:
                return HostPlatformResolver.LinuxPlatformInstance;
        }
    }
}
