// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.

/**
 * Defines the supported launch arguments.
 * Add more arguments here as needed.
 */
export interface ILaunchArgs {
    platform: string;
    workspaceRoot: string;
    projectRoot: string;
    target?: "simulator" | "device";
    debugAdapterPort?: number;
    packagerPort?: any;
    runArguments?: string[];
    env?: any;
    envFile?: string;
}

/**
 * Defines the options needed to start debugging a project.
 */

export interface IAndroidRunOptions extends ILaunchArgs {
    variant?: string;
    logCatArguments?: any;
}

export interface IIOSRunOptions extends ILaunchArgs {
    scheme?: string;
<<<<<<< HEAD
=======
    iosRelativeProjectPath?: string; // TODO Remove deprecated
    productName?: string;
    configuration?: string;
>>>>>>> 3e313f6f67947ce34ff732411733f8750203f316
}

export interface IWindowsRunOptions extends ILaunchArgs {
}

export interface IRunOptions extends IAndroidRunOptions, IIOSRunOptions, IWindowsRunOptions  {

}
