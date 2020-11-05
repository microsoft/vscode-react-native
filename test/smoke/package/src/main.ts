// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.

import {smokeTestFail} from "./helpers/utilities";
import * as path from "path";
import AndroidEmulatorManager from "./helpers/AndroidEmulatorManager";
import { AppiumHelper } from "./helpers/appiumHelper";
import IosSimulatorManager from "./helpers/IosSimulatorManager";
import { SmokeTestsConstants } from "./helpers/smokeTestsConstants";
import { TestApplicationSetupManager } from "./helpers/TestApplicationSetupManager";
import { TestConfigProcessor } from "./helpers/TestConfigProcessor";
import { VsCodeManager } from "./helpers/VsCodeManager";
import { startSmokeTests } from "./smoke.test";

// Check tests environments
if (parseInt(process.version.substr(1), 10) < 10) {
    smokeTestFail("Please update your Node version to greater than 10 to run the smoke test.");
}

//Paths
const envConfigFilePath = path.resolve(__dirname, "..", SmokeTestsConstants.EnvConfigFileName);
const envConfigFilePathDev = path.resolve(__dirname, "..", SmokeTestsConstants.EnvDevConfigFileName);
const vscodeTestPath = path.resolve(__dirname, "..", "vscode-test");
const resourcesPath = path.resolve(__dirname, "..", "resources");
const cachePath = path.resolve(__dirname, "..", "..", "..", "..", "..", "..", "..", "SmokeTestsCache");

const configProcessor = new TestConfigProcessor(envConfigFilePath, envConfigFilePathDev);
const testApplicationSetupManager = new TestApplicationSetupManager(resourcesPath, cachePath);
const androidEmulatorManager = new AndroidEmulatorManager();
const iosSimulatorManager = new IosSimulatorManager();
export const vscodeManager = new VsCodeManager(vscodeTestPath, resourcesPath, cachePath);

startSmokeTests(configProcessor.parseTestArguments(), setUp, cleanUp);

async function setUp(): Promise<void> {
    try {
        return vscodeManager.downloadVSCodeExecutable()
        .then(() => vscodeManager.installExtensionFromVSIX())
        .then(() => vscodeManager.installExpoXdlPackageToExtensionDir())
        .then(() => testApplicationSetupManager.prepareTestApplications())
        .then(() => AppiumHelper.runAppium())
        .then(async () => {
            console.log("*** Preparing Android emulator...");
            await androidEmulatorManager.runAndroidEmulator();
            await androidEmulatorManager.installExpoAppOnAndroid();
        })
        .then(async () => {
            if (process.platform === "darwin") {
                console.log("*** Preparing iOS simulator...");
                await iosSimulatorManager.runIosSimulator();
                await iosSimulatorManager.installExpoAppOnIos();
            }
        });
    }
    catch (error) {
        smokeTestFail(error);
    }
}

async function cleanUp(): Promise<void> {
    try {
        vscodeManager.cleanUp();
        testApplicationSetupManager.cleanUp();
    }
    catch (error) {
        smokeTestFail(error);
    }
}