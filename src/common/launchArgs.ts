// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.

/**
 * Defines the options needed to start debugging a project.
 */
export interface IRunOptions extends ILaunchArgs {
    projectRoot: string;
}

/**
 * Defines the supported launch arguments.
 * Add more arguments here as needed.
 */
export interface ILaunchArgs {
    platform?: string;
    target?: string;
    debugAdapterPort?: number;
}