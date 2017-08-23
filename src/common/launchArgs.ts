// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.

/**
 * Defines the supported launch arguments.
 * Add more arguments here as needed.
 */
export interface ILaunchArgs {
    platform: string;
    projectRoot: string;
    target?: string;
    targetType?: "simulator" | "device";
    debugAdapterPort?: number;
    logCatArguments?: any;
    packagerPort?: any;
}

/**
 * Defines the options needed to start debugging a project.
 */

export interface IAndroidRunOptions extends ILaunchArgs {
    native_folder?: string;
    variant?: string;
}

export interface IIOSRunOptions extends ILaunchArgs {
    native_folder?: string;
    scheme?: string;
    iosRelativeProjectPath?: string; // TODO Remove deprecated
}

export interface IRunOptions extends IAndroidRunOptions, IIOSRunOptions  {

}
