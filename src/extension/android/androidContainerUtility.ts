// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.

import { AdbHelper } from "./adb";
import * as path from "path";
import { OutputChannelLogger } from "../log/OutputChannelLogger";

const allowedAppNameRegex = /^[\w.-]+$/;
const appNotApplicationRegex = /not an application/;
const appNotDebuggableRegex = /debuggable/;
const operationNotPermittedRegex = /not permitted/;
const deviceTmpDir = "/sdcard/";

// The code is borrowed from https://github.com/facebook/flipper/blob/master/desktop/app/src/utils/androidContainerUtility.tsx,
// https://github.com/facebook/flipper/blob/master/desktop/app/src/utils/androidContainerUtilityInternal.tsx

enum RunAsErrorCode {
    NotAnApp = 1,
    NotDebuggable = 2,
}

class RunAsError extends Error {
    code: RunAsErrorCode;

    constructor(code: RunAsErrorCode, message?: string) {
        super(message);
        this.code = code;
        Object.setPrototypeOf(this, new.target.prototype);
    }
}

/**
 * @preserve
 * Start region: the code is borrowed from https://github.com/facebook/flipper/blob/v0.79.1/desktop/app/src/utils/androidContainerUtility.tsx#L19-L46
 *
 * Copyright (c) Facebook, Inc. and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * @format
 */

export async function push(
    adbHelper: AdbHelper,
    deviceId: string,
    app: string,
    filepath: string,
    contents: string,
    logger?: OutputChannelLogger,
): Promise<void> {
    const validApp = await validateAppName(app);
    const validFilepath = await validateFilePath(filepath);
    const validContent = await validateFileContent(contents);
    return await _push(adbHelper, deviceId, validApp, validFilepath, validContent, logger);
}

export async function pull(
    adbHelper: AdbHelper,
    deviceId: string,
    app: string,
    path: string,
    logger?: OutputChannelLogger,
): Promise<string> {
    const validApp = await validateAppName(app);
    const validPath = await validateFilePath(path);
    return await _pull(adbHelper, deviceId, validApp, validPath, logger);
}

/**
 * @preserve
 * End region: https://github.com/facebook/flipper/blob/v0.79.1/desktop/app/src/utils/androidContainerUtility.tsx#L19-L46
 */

export async function pushFile(
    adbHelper: AdbHelper,
    deviceId: string,
    app: string,
    destFilepath: string,
    sourceFilepath: string,
    logger?: OutputChannelLogger,
): Promise<void> {
    const validApp = await validateAppName(app);
    const validFilepath = await validateFilePath(destFilepath);
    return await _pushFile(adbHelper, deviceId, validApp, validFilepath, sourceFilepath, logger);
}

async function _pushFile(
    adbHelper: AdbHelper,
    deviceId: string,
    app: string,
    destFilepath: string,
    sourceFilepath: string,
    logger?: OutputChannelLogger,
): Promise<void> {
    const destFileName = path.basename(destFilepath);
    const tmpFilePath = deviceTmpDir + destFileName;

    try {
        const pushRes = await adbHelper.executeQuery(
            deviceId,
            `push ${sourceFilepath} ${tmpFilePath}`,
        );
        logger?.debug(pushRes);
        const command = `cp "${tmpFilePath}" "${destFilepath}" && chmod 644 "${destFilepath}"`;
        const appCommandRes = await executeCommandAsApp(adbHelper, deviceId, app, command);
        logger?.debug(appCommandRes);
    } finally {
        await adbHelper.executeShellCommand(deviceId, `rm ${tmpFilePath}`);
    }
}

/**
 * @preserve
 * Start region: the code is borrowed from https://github.com/facebook/flipper/blob/v0.79.1/desktop/app/src/utils/androidContainerUtilityInternal.tsx
 *
 * Copyright (c) Facebook, Inc. and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * @format
 */

async function validateAppName(app: string): Promise<string> {
    if (app.match(allowedAppNameRegex)) {
        return app;
    }
    throw new Error(`Disallowed run-as user: ${app}`);
}

async function validateFilePath(filePath: string): Promise<string> {
    if (!filePath.match(/[']/)) {
        return filePath;
    }
    throw new Error(`Disallowed escaping filepath: ${filePath}`);
}

async function validateFileContent(content: string): Promise<string> {
    if (!content.match(/["]/)) {
        return content;
    }
    throw new Error(`Disallowed escaping file content: ${content}`);
}

async function _push(
    adbHelper: AdbHelper,
    deviceId: string,
    app: string,
    filename: string,
    contents: string,
    logger?: OutputChannelLogger,
): Promise<void> {
    const command = `echo \\"${contents}\\" > "${filename}" && chmod 644 "${filename}"`;
    try {
        const res = await executeCommandAsApp(adbHelper, deviceId, app, command);
        logger?.debug(res);
    } catch (error) {
        if (error instanceof RunAsError) {
            // Fall back to running the command directly. This will work if adb is running as root.
            try {
                await executeCommandWithSu(adbHelper, deviceId, app, command);
            } catch (innerError) {
                logger?.debug(innerError.toString());
                // Throw the original error.
                throw error;
            }
        }
        throw error;
    }
}

async function _pull(
    adbHelper: AdbHelper,
    deviceId: string,
    app: string,
    path: string,
    logger?: OutputChannelLogger,
): Promise<string> {
    const command = `cat "${path}"`;
    try {
        return executeCommandAsApp(adbHelper, deviceId, app, command);
    } catch (error) {
        if (error instanceof RunAsError) {
            // Fall back to running the command directly. This will work if adb is running as root.
            try {
                await executeCommandWithSu(adbHelper, deviceId, app, command);
            } catch (innerError) {
                logger?.debug(innerError.toString());
                // Throw the original error.
                throw error;
            }
        }
        throw error;
    }
}

// Keep this method private since it relies on pre-validated arguments
function executeCommandAsApp(
    adbHelper: AdbHelper,
    deviceId: string,
    app: string,
    command: string,
): Promise<string> {
    return _executeCommandWithRunner(adbHelper, deviceId, app, command, `run-as '${app}'`);
}

function executeCommandWithSu(
    adbHelper: AdbHelper,
    deviceId: string,
    app: string,
    command: string,
): Promise<string> {
    return _executeCommandWithRunner(adbHelper, deviceId, app, command, "su");
}

async function _executeCommandWithRunner(
    adbHelper: AdbHelper,
    deviceId: string,
    app: string,
    command: string,
    runner: string,
): Promise<string> {
    const output = await adbHelper.executeShellCommand(deviceId, `echo '${command}' | ${runner}`);
    if (output.match(appNotApplicationRegex)) {
        throw new RunAsError(
            RunAsErrorCode.NotAnApp,
            `Android package ${app} is not an application. To use it with Flipper, either run adb as root or add an <application> tag to AndroidManifest.xml`,
        );
    }
    if (output.match(appNotDebuggableRegex)) {
        throw new RunAsError(
            RunAsErrorCode.NotDebuggable,
            `Android app ${app} is not debuggable. To use it with Flipper, add android:debuggable="true" to the application section of AndroidManifest.xml`,
        );
    }
    if (output.toLowerCase().match(operationNotPermittedRegex)) {
        throw new Error(
            `Your android device (${deviceId}) does not support the adb shell run-as command. We're tracking this at https://github.com/facebook/flipper/issues/92`,
        );
    }
    return output;
}

/**
 * @preserve
 * End region: https://github.com/facebook/flipper/blob/v0.79.1/desktop/app/src/utils/androidContainerUtilityInternal.tsx
 */
