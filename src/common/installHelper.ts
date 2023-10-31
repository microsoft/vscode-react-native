// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.

// import * as fs from "fs";
// import * as https from "https";
// import * as vscode from "vscode";
import { AdbHelper } from "../extension/android/adb";
import { AppLauncher } from "../extension/appLauncher";
import { OutputChannelLogger } from "../extension/log/OutputChannelLogger";
import { ChildProcess } from "./node/childProcess";

export async function installAndroidApplication(project: AppLauncher, appPath: string) {
    const logger = OutputChannelLogger.getMainChannel();
    const childProcess: ChildProcess = new ChildProcess();
    const adbHelper = new AdbHelper(
        project.getPackager().getProjectPath(),
        project.getOrUpdateNodeModulesRoot(),
    );

    const targets = await adbHelper.getOnlineTargets();
    if (targets.length == 0) {
        throw new Error("No online target found, please check your emulator status.");
    } else if (targets.length > 1) {
        logger.logStream(
            `Found ${targets.length} online emulators, installing application on ${targets[0].id}. \n`,
        );
    } else {
        logger.logStream(`Installing application on ${targets[0].id}. \n`);
        try {
            await childProcess.execToString(`adb install ${appPath}`);
        } catch {
            throw new Error(`Failed to install application: ${appPath}.`);
        }
        logger.logStream(`Install Android application is completed. \n`);
    }
}

export async function installiOSApplication(project: AppLauncher, appPath: string) {
    const logger = OutputChannelLogger.getMainChannel();
    const childProcess: ChildProcess = new ChildProcess();
    const getBootedSimulatorCommand = "xcrun simctl list | awk -F'[()]' '/(Booted)/ { print $2 }'";

    const targetResult = await childProcess.execToString(getBootedSimulatorCommand);
    const targets = targetResult.split("\n");

    try {
        await childProcess.execToString(
            `mkdir ${project.getPackager().getProjectPath()}/expoApp.app`,
        );
        await childProcess.execToString(
            `tar -xf ${appPath} -C ${project.getPackager().getProjectPath()}/expoApp.app`,
        );
    } catch (e) {
        throw e;
    }

    const installCommand = `xcrun simctl install ${targets[0]} ${project
        .getPackager()
        .getProjectPath()}/expoApp.app`;
    if (targets.length == 1) {
        throw new Error("No booted iOS simulator found, please check your simulator status.");
    } else if (targets.length > 2) {
        logger.logStream(
            `Found ${targets.length - 1} booted simulators, installing application on ${
                targets[0]
            }. \n`,
        );
        try {
            await childProcess.execToString(installCommand);
        } catch {
            throw new Error(`Failed to install application: ${appPath}.`);
        }
    } else {
        logger.logStream(`Installing application on ${targets[0]}. \n`);
        try {
            await childProcess.execToString(installCommand);
        } catch {
            throw new Error(`Failed to install application: ${appPath}.`);
        }
        logger.logStream(`Install iOS application is completed. \n`);
    }
}
