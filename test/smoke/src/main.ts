// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.

import * as fs from "fs";
import * as path from "path";
import * as cp from "child_process";
import { SpectronApplication, Quality } from "./spectron/application";
import { AppiumHelper } from "./helpers/appiumHelper";
import { SmokeTestsConstants } from "./helpers/smokeTestsConstants";
import { setup as setupReactNativeDebugAndroidTests } from "./debugAndroid.test";
import { setup as setupReactNativeDebugiOSTests } from "./debugIos.test";
import { AndroidEmulatorHelper } from "./helpers/androidEmulatorHelper";
import { VSCodeHelper } from "./helpers/vsCodeHelper";
import { SetupEnvironmentHelper } from "./helpers/setupEnvironmentHelper";
import { TestConfigurator } from "./helpers/configHelper";
import { sleep, findFile } from "./helpers/utilities";

interface IRNGlobalCLISwitch {
    enableGlobalCLIApproach(): void;
    disableGlobalCLIApproach(): void;
}

// TODO Incapsulate main.ts (get rid of function(), local variables, etc)
console.log(`*** Setting up configuration variables`);
const envConfigFilePath = path.resolve(__dirname, "..", SmokeTestsConstants.EnvConfigFileName);
// Assume that config.dev.json are stored in the same folder as original config.json
const envConfigFilePathDev = path.resolve(__dirname, "..", SmokeTestsConstants.EnvDevConfigFileName);

TestConfigurator.setUpEnvVariables(fs.existsSync(envConfigFilePathDev) ? envConfigFilePathDev : envConfigFilePath);
TestConfigurator.printEnvVariableConfiguration();

async function fail(errorMessage) {
    console.error(errorMessage);
    AndroidEmulatorHelper.terminateAndroidEmulator();
    if (process.platform === "darwin") {
        try {
            await SetupEnvironmentHelper.terminateIosSimulator();
        } catch (e) {
            console.error(e);
        }
    }
    AppiumHelper.terminateAppium();
    process.exit(1);
}

if (parseInt(process.version.substr(1), 10) < 8) {
    fail("Please update your Node version to greater than 8 to run the smoke test.");
}

function getBuildElectronPath(root: string, isInsiders: boolean): string {
    switch (process.platform) {
        case "darwin":
            return isInsiders
                ?
                path.join(root, "Visual Studio Code - Insiders.app", "Contents", "MacOS", "Electron")
                :
                path.join(root, "Visual Studio Code.app", "Contents", "MacOS", "Electron");
        case "linux": {
            const product = require(path.join(root, "VSCode-linux-x64", "resources", "app", "product.json"));
            return path.join(root, "VSCode-linux-x64", product.applicationName);
        }
        case "win32": {
            const product = require(path.join(root, "resources", "app", "product.json"));
            return path.join(root, `${product.nameShort}.exe`);
        }
        default:
            throw new Error(`Platform ${process.platform} isn't supported`);
    }
}

function getVSCodeExecutablePath(testVSCodeFolder: string, isInsiders: boolean) {
    switch (process.platform) {
        case "darwin":
            return isInsiders
                ?
                path.join(testVSCodeFolder, "Visual Studio Code - Insiders.app", "Contents", "Resources", "app", "bin", "code")
                :
                path.join(testVSCodeFolder, "Visual Studio Code.app", "Contents", "Resources", "app", "bin", "code");
        case "win32":
            return isInsiders
                ?
                path.join(testVSCodeFolder, "bin", "code-insiders.cmd")
                :
                path.join(testVSCodeFolder, "bin", "code.cmd");
        case "linux":
            return isInsiders
                ?
                path.join(testVSCodeFolder, "VSCode-linux-x64", "bin", "code-insiders")
                :
                path.join(testVSCodeFolder, "VSCode-linux-x64", "bin", "code");
        default:
            throw new Error(`Platform ${process.platform} isn't supported`);
    }
}

const repoRoot = path.join(__dirname, "..", "..", "..");
const resourcesPath = path.join(__dirname, "..", "resources");
const isInsiders = process.env.CODE_VERSION === "insiders";
let testVSCodeDirectory;
if (!isInsiders) {
    testVSCodeDirectory = path.join(resourcesPath, ".vscode-test", "stable");
} else {
    testVSCodeDirectory = path.join(resourcesPath, ".vscode-test", "insiders");
}

let electronExecutablePath: string;

let quality: Quality;
if (isInsiders) {
    quality = Quality.Insiders;
} else {
    quality = Quality.Stable;
}

export let winTaskKillCommands: string[] = [];
if (process.platform === "win32") {
    const userName = cp.execSync("whoami").toString().trim();
    winTaskKillCommands = VSCodeHelper.getTaskKillCommands(testVSCodeDirectory, isInsiders, userName);
}

/**
 * WebDriverIO 4.8.0 outputs all kinds of "deprecation" warnings
 * for common commands like `keys` and `moveToObject`.
 * According to https://github.com/Codeception/CodeceptJS/issues/531,
 * these deprecation warnings are for Firefox, and have no alternative replacements.
 * Since we can't downgrade WDIO as suggested (it's Spectron's dep, not ours),
 * we must suppress the warning with a classic monkey-patch.
 *
 * @see webdriverio/lib/helpers/depcrecationWarning.js
 * @see https://github.com/webdriverio/webdriverio/issues/2076
 */
// Filter out the following messages:
const wdioDeprecationWarning = /^WARNING: the "\w+" command will be deprecated soon../; // [sic]
// Monkey patch:
const warn = console.warn;
console.warn = function suppressWebdriverWarnings(message) {
    if (wdioDeprecationWarning.test(message)) { return; }
    warn.apply(console, arguments);
};

export const RNworkspacePath = path.join(resourcesPath, SmokeTestsConstants.RNAppName);
const RNworkspaceFilePath = path.join(RNworkspacePath, SmokeTestsConstants.AppjsFileName);
export const ExpoWorkspacePath = path.join(resourcesPath, SmokeTestsConstants.ExpoAppName);
const ExpoWorkspaceFilePath = path.join(ExpoWorkspacePath, SmokeTestsConstants.AppjsFileName);
export const pureRNWorkspacePath = path.join(resourcesPath, SmokeTestsConstants.pureRNExpoApp);
const pureRNWorkspaceFilePath = path.join(pureRNWorkspacePath, SmokeTestsConstants.AppjsFileName);

export const artifactsPath = path.join(repoRoot, SmokeTestsConstants.artifactsDir);
const userDataDir = path.join(testVSCodeDirectory, SmokeTestsConstants.VSCodeUserDataDir);

const extensionsPath = path.join(testVSCodeDirectory, "extensions");

const keybindingsPath = path.join(userDataDir, "keybindings.json");
process.env.VSCODE_KEYBINDINGS_PATH = keybindingsPath;

function createApp(quality: Quality, workspaceOrFolder: string): SpectronApplication | null {

    if (!electronExecutablePath) {
        return null;
    }

    console.log(`*** Executing ${electronExecutablePath} with Spectron`);
    return new SpectronApplication({
        quality,
        electronPath: electronExecutablePath,
        workspacePath: workspaceOrFolder,
        userDataDir,
        extensionsPath,
        artifactsPath,
        workspaceFilePath: "",
        waitTime: SmokeTestsConstants.spectronElementResponseTimeout,
    });
}

export let reactNativeGlobalCLIApproachSwitch: IRNGlobalCLISwitch = {
    enableGlobalCLIApproach() {
        SetupEnvironmentHelper.prepareReactNativeGlobalCLIApproach(resourcesPath, RNworkspacePath);
    },
    disableGlobalCLIApproach() {
        SetupEnvironmentHelper.removeSettingsFromReactNativeProject(RNworkspacePath);
    },
};

const testParams = TestConfigurator.parseTestArguments();
async function setup(): Promise<void> {
    console.log("*** Test VS Code directory:", testVSCodeDirectory);
    console.log("*** Preparing smoke tests setup...");

    AppiumHelper.runAppium();

    if (process.platform === "darwin") {
        await SetupEnvironmentHelper.runIosSimulator();
    }

    await AndroidEmulatorHelper.runAndroidEmulator();

    SetupEnvironmentHelper.prepareReactNativeApplication(RNworkspaceFilePath, resourcesPath, RNworkspacePath, SmokeTestsConstants.RNAppName, "ReactNativeSample", process.env.RN_VERSION);
    if (!testParams.RunBasicTests) {
        SetupEnvironmentHelper.prepareExpoApplication(ExpoWorkspaceFilePath, resourcesPath, ExpoWorkspacePath, SmokeTestsConstants.ExpoAppName);
        const PureRNVersionExpo = process.env.PURE_RN_VERSION || await SetupEnvironmentHelper.getLatestSupportedRNVersionForExpo();
        SetupEnvironmentHelper.prepareReactNativeApplication(pureRNWorkspaceFilePath, resourcesPath, pureRNWorkspacePath, SmokeTestsConstants.pureRNExpoApp, "PureRNExpoSample", PureRNVersionExpo);
        SetupEnvironmentHelper.addExpoDependencyToRNProject(pureRNWorkspacePath, process.env.PURE_EXPO_VERSION);
        await SetupEnvironmentHelper.installExpoAppOnAndroid(ExpoWorkspacePath);
        SetupEnvironmentHelper.patchExpoSettingsFile(ExpoWorkspacePath);
        if (process.platform === "darwin") {
            // We need only to download expo app, but this is the quickest way of doing it
            await SetupEnvironmentHelper.installExpoAppOnIos(ExpoWorkspacePath);
        }
    }
    await VSCodeHelper.downloadVSCodeExecutable(resourcesPath);

    electronExecutablePath = getBuildElectronPath(testVSCodeDirectory, isInsiders);
    if (!fs.existsSync(testVSCodeDirectory || "")) {
        await fail(`Can't find VS Code executable at ${testVSCodeDirectory}.`);
    }
    const testVSCodeExecutablePath = getVSCodeExecutablePath(testVSCodeDirectory, isInsiders);
    VSCodeHelper.installExtensionFromVSIX(extensionsPath, testVSCodeExecutablePath, resourcesPath, !testParams.DontDeleteVSIX);

    if (process.env.EXPO_XDL_VERSION) {
        // msjsdiag.vscode-react-native-0.9.3
        const extensionDirName = findFile(extensionsPath, /msjsdiag\.vscode-react-native.*/);
        if (!extensionDirName) {
            throw new Error("Couldn't find extension directory");
        }
        const extensionFullPath = path.join(extensionsPath, extensionDirName);
        SetupEnvironmentHelper.installExpoXdlPackageToExtensionDir(extensionFullPath, process.env.EXPO_XDL_VERSION);
    } else {
        console.log(`*** EXPO_XDL_VERSION variable is not set, skipping installation of @expo/xdl package to the extension directory`);
    }

    if (!fs.existsSync(userDataDir)) {
        console.log(`*** Creating VS Code user data directory: ${userDataDir}`);
        fs.mkdirSync(userDataDir);
    }
    await VSCodeHelper.fetchKeybindings(keybindingsPath);
    console.log("*** Smoke tests setup done!\n");
}

export async function runVSCode(workspaceOrFolder: string): Promise<SpectronApplication> {
    const app = createApp(quality, workspaceOrFolder);
    await app!.start();
    await sleep(5000);
    await app!.prepareMainWindow();
    return app!;
}

before(async function () {
    if (testParams.SkipSetup) {
        console.log("*** --skip-setup parameter is set, skipping clean up and apps installation");
        // Assume that VS Code is already installed
        electronExecutablePath = getBuildElectronPath(testVSCodeDirectory, isInsiders);
        return;
    }
    this.timeout(SmokeTestsConstants.smokeTestSetupAwaitTimeout);
    SetupEnvironmentHelper.cleanUp(path.join(testVSCodeDirectory, ".."), artifactsPath, [RNworkspacePath, ExpoWorkspacePath, pureRNWorkspacePath], SetupEnvironmentHelper.iOSExpoAppsCacheDir);
    try {
        await setup();
    } catch (err) {
        await fail(err);
    }
});

describe("Extension smoke tests", () => {
    after(async function () {
        AndroidEmulatorHelper.terminateAndroidEmulator();
        if (process.platform === "darwin") {
            try {
                await SetupEnvironmentHelper.terminateIosSimulator();
            } catch (e) {
                console.error(e);
            }
        }
        AppiumHelper.terminateAppium();
    });
    if (process.platform === "darwin") {
        const noSelectArgs = !testParams.RunAndroidTests && !testParams.RunIosTests && !testParams.RunBasicTests;
        if (noSelectArgs) {
            console.log("*** Android and iOS tests will be run");
            setupReactNativeDebugAndroidTests();
            setupReactNativeDebugiOSTests();
        } else if (testParams.RunBasicTests) {
            console.log("*** --basic-only parameter is set, basic Android and iOS tests will be run");
            setupReactNativeDebugAndroidTests(testParams);
            setupReactNativeDebugiOSTests(testParams);
        } else if (testParams.RunAndroidTests) {
            console.log("*** --android parameter is set, Android tests will be run");
            setupReactNativeDebugAndroidTests();
        } else if (testParams.RunIosTests) {
            console.log("*** --ios parameter is set, iOS tests will be run");
            setupReactNativeDebugiOSTests();
        }
    } else {
        if (testParams.RunBasicTests) {
            console.log("*** --basic-only parameter is set, basic Android tests will be run");
            setupReactNativeDebugAndroidTests(testParams);
        } else {
            setupReactNativeDebugAndroidTests();
        }

    }
});
