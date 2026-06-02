// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.

import { AdbHelper } from "../extension/android/adb";
import { AppLauncher } from "../extension/appLauncher";
import { SimctrlHelper } from "../extension/ios/simctl";
import { OutputChannelLogger } from "../extension/log/OutputChannelLogger";
import { ChildProcess } from "./node/childProcess";

export async function installAndroidApplication(project: AppLauncher, appPath: string) {
    const logger = OutputChannelLogger.getMainChannel();
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
        try {
            await adbHelper.installApplicationToEmulator(appPath);
        } catch {
            throw new Error(`Failed to install application: ${appPath}.`);
        }
    } else {
        logger.logStream(`Installing application on ${targets[0].id}. \n`);
        try {
            await adbHelper.installApplicationToEmulator(appPath);
        } catch {
            throw new Error(`Failed to install application: ${appPath}.`);
        }
        logger.logStream(`Install Android application is completed. \n`);
    }
}

export async function installiOSApplication(project: AppLauncher, appPath: string) {
    const logger = OutputChannelLogger.getMainChannel();
    const childProcess: ChildProcess = new ChildProcess();

    const targets = await SimctrlHelper.getBootediOSSimulatorList();

    try {
        // Create dir to iOS app
        const appDir = `${project.getPackager().getProjectPath()}/expoApp.app`;
        await childProcess.execFileToString("mkdir", [appDir]);

        // Unpack .tar.gz file
        await childProcess.execFileToString("tar", ["-xf", appPath, "-C", appDir]);
    } catch (e) {
        throw e;
    }

    if (targets.length == 1) {
        throw new Error("No booted iOS simulator found, please check your simulator status.");
    } else if (targets.length > 2) {
        logger.logStream(
            `Found ${targets.length - 1} booted simulators, installing application on ${
                targets[0]
            }. \n`,
        );
        try {
            await SimctrlHelper.installApplicationToSimulator(
                targets[0],
                `${project.getPackager().getProjectPath()}/expoApp.app`,
            );
        } catch {
            throw new Error(`Failed to install application: ${appPath}.`);
        }
    } else {
        logger.logStream(`Installing application on ${targets[0]}. \n`);
        try {
            await SimctrlHelper.installApplicationToSimulator(
                targets[0],
                `${project.getPackager().getProjectPath()}/expoApp.app`,
            );
        } catch {
            throw new Error(`Failed to install application: ${appPath}.`);
        }
        logger.logStream(`Install iOS application is completed. \n`);
    }
}
