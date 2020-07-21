// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.

/* The recording is used by Recorder to store a recording, and by
   Simulator to read it and simulate it.

   File order: This file is ordered in a top-down approach */

export interface Recording {
    /* Metadata */
    title: string;
    arguments: ISpawnArguments;
    date: Date;
    configuration: MachineConfiguration;
    state: MachineState;

    /* Recorded events data */
    events: IEventArguments[];
}

export interface ISpawnArguments {
    command: string;
    args: string[];
    options: ISpawnOptions;
}

export interface ISpawnOptions {
    cwd?: string;
    stdio?: any;
    env?: any;
    detached?: boolean;
}

export interface MachineConfiguration {
    os: { platform: string; release: string };
    android: {
        sdk: {
            tools: string;
            platformTools: string;
            buildTools: string;
            repositoryForSupportLibraries: string;
        };
        intelHAXMEmulator: string;
        visualStudioEmulator: string;
    };
    reactNative: string;
    node: string;
    npm: string;
}

export interface MachineState {
    reactNative: { packager: PackagerStatus };
    devices: { android: IAndroidDevice[]; ios: IIOSDevice[] };
}

export type PackagerStatus = "Running" | "NotRunning" | "TBD";

export interface IAndroidDevice {
    id: string;
    type: AndroidDeviceType;
    hardware: string;
    os: string;
    api: number;
    otherSpecs: string;
    appStatus: AppStatusInDevice;
}

export type AndroidDeviceType =
    | "SDKEmulator"
    | "VisualStudioEmulator"
    | "IntelHAXMEmulator_x86"
    | "IntelHAXMEmulator_x64"
    | "PhysicalDevice";

export type AppStatusInDevice = "NotInstalled" | "Installed" | "Running" | "Debugging" | "TBD";

export interface IIOSDevice {
    id: string;
    type: IIOSDeviceType;
    appStatus: AppStatusInDevice;
}

export type IIOSDeviceType = "TBD";

export type IEventArguments = IStdOutEvent | IStdErrEvent | IErrorEvent | IExitEvent | ICustomEvent;

export interface ITimedEvent {
    after: number;
}

export interface IStdOutEvent extends ITimedEvent {
    stdout: { data: string };
}

export interface IStdErrEvent extends ITimedEvent {
    stderr: { data: string };
}

export interface IErrorEvent extends ITimedEvent {
    error: { error: any };
}

export interface IExitEvent extends ITimedEvent {
    exit: { code: number };
}

export interface ICustomEvent extends ITimedEvent {
    custom: { lambda: () => Promise<void> | void };
}
