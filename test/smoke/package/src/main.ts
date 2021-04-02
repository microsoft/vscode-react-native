// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.

import { sleep, smokeTestFail } from "./helpers/utilities";
import * as path from "path";
import AndroidEmulatorManager from "./helpers/androidEmulatorManager";
import { AppiumHelper } from "./helpers/appiumHelper";
import IosSimulatorManager from "./helpers/iosSimulatorManager";
import { SmokeTestsConstants } from "./helpers/smokeTestsConstants";
import { TestApplicationSetupManager } from "./helpers/testApplicationSetupManager";
import { TestConfigProcessor } from "./helpers/testConfigProcessor";
import { VsCodeManager } from "./helpers/vsCodeManager";
import { startSmokeTests } from "./smoke.test";
import * as os from "os";
import { SmokeTestLogger } from "./helpers/smokeTestLogger";

// Check tests environments
if (parseInt(process.version.substr(1), 10) < 10) {
    smokeTestFail("Please update your Node version to greater than 10 to run the smoke test.");
}

//Paths
const repoRoot = path.join(__dirname, "..", "..", "..", "..", "..", "..");
const envConfigFilePath = path.resolve(__dirname, "..", SmokeTestsConstants.EnvConfigFileName);
const envConfigFilePathDev = path.resolve(
    __dirname,
    "..",
    SmokeTestsConstants.EnvDevConfigFileName,
);
const vscodeTestPath = path.resolve(__dirname, "..", ".vscode-test");
const resourcesPath = path.resolve(__dirname, "..", "resources");
const cachePath = path.resolve(os.homedir(), "SmokeTestsCache");

const configProcessor = new TestConfigProcessor(envConfigFilePath, envConfigFilePathDev);
export const testApplicationSetupManager = new TestApplicationSetupManager(
    resourcesPath,
    cachePath,
);
export const androidEmulatorManager = new AndroidEmulatorManager();
export const iosSimulatorManager = new IosSimulatorManager();
export const vscodeManager = new VsCodeManager(vscodeTestPath, resourcesPath, cachePath, repoRoot);

startSmokeTests(configProcessor.parseTestArguments(), setUp, cleanUp);

async function setUp(useCachedApplications: boolean): Promise<void> {
    await vscodeManager.downloadVSCodeExecutable();
    await vscodeManager.installExtensionFromVSIX();
    await vscodeManager.installExpoXdlPackageToExtensionDir();
    await testApplicationSetupManager.prepareTestApplications(useCachedApplications);
    await AppiumHelper.runAppium(vscodeManager.getAppiumLogDir());

    SmokeTestLogger.info("*** Preparing Android emulator...");
    await androidEmulatorManager.runAndroidEmulator();
    await androidEmulatorManager.installExpoAppOnAndroid();

    if (process.platform === "darwin") {
        SmokeTestLogger.info("*** Preparing iOS simulator...");
        await iosSimulatorManager.runIosSimulator();
        // Waiting for all services to start
        await sleep(60_000);
        await iosSimulatorManager.installExpoAppOnIos();
    }
}

async function cleanUp(saveCache: boolean): Promise<void> {
    vscodeManager.cleanUp();
    testApplicationSetupManager.cleanUp(saveCache);
}
