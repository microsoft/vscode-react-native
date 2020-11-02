// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.

import * as fs from "fs";
import * as path from "path";
import * as cp from "child_process";
import { ConsoleLogger } from "./helpers/consoleLogger";
import { Application, Quality, ApplicationOptions, MultiLogger, Logger, ConsoleLogger as VSCodeConsoleLogger } from "../../automation";
import { AppiumHelper } from "./helpers/appiumHelper";
import { SmokeTestsConstants } from "./helpers/smokeTestsConstants";
import { setup as setupReactNativeDebugAndroidTests } from "./debugAndroid.test";
import { setup as setupReactNativeDebugiOSTests } from "./debugIos.test";
import { setup as setupLocalizationTests } from "./localization.test";
import { AndroidEmulatorHelper } from "./helpers/androidEmulatorHelper";
import { VSCodeHelper } from "./helpers/vsCodeHelper";
import { SetupEnvironmentHelper } from "./helpers/setupEnvironmentHelper";
import { TestConfigurator } from "./helpers/configHelper";
import { findFile } from "./helpers/utilities";

// TODO Incapsulate main.ts (get rid of function(), local variables, etc)
console.log(`\x1b[33m *** Setting up configuration variables`);
const envConfigFilePath = path.resolve(__dirname, "..", SmokeTestsConstants.EnvConfigFileName);
// Assume that config.dev.json are stored in the same folder as original config.json
const envConfigFilePathDev = path.resolve(__dirname, "..", SmokeTestsConstants.EnvDevConfigFileName);

TestConfigurator.setUpEnvVariables(fs.existsSync(envConfigFilePathDev) ? envConfigFilePathDev : envConfigFilePath);
TestConfigurator.printEnvVariableConfiguration();

async function fail(errorMessage) {
    ConsoleLogger.error(errorMessage);
    AndroidEmulatorHelper.terminateAndroidEmulator();
    if (process.platform === "darwin") {
        try {
            await SetupEnvironmentHelper.terminateIosSimulator();
        } catch (e) {
            ConsoleLogger.error(e);
        }
    }
    AppiumHelper.terminateAppium();
    process.exit(1);
}

if (parseInt(process.version.substr(1), 10) < 10) {
    fail("Please update your Node version to greater than 10 to run the smoke test.");
}

function getBuildElectronPath(root: string, isInsiders: boolean): string {
    switch (process.platform) {
        case "darwin":
            return isInsiders
                ?
                path.join(root, "Visual Studio Code - Insiders.app")
                :
                path.join(root, "Visual Studio Code.app");
        case "linux": {
            return path.join(root, "VSCode-linux-x64");
        }
        case "win32": {
            return root;
        }
        default:
            throw new Error(`Platform ${process.platform} isn't supported`);
    }
}

// resolving path from VS Code smoke tests directory to repository root
const repoRoot = path.join(__dirname, "..", "..", "..", "..", "..", "..");
const resourcesPath = path.join(__dirname, "..", "resources");
const isInsiders = process.env.CODE_VERSION === "insiders";
let testVSCodeDirectory = path.join(__dirname, "..", ".vscode-test", `vscode-${process.env.CODE_VERSION}`);

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

export const RNworkspacePath = path.join(resourcesPath, SmokeTestsConstants.RNAppName);
const RNworkspaceFilePath = path.join(RNworkspacePath, SmokeTestsConstants.AppjsFileName);
export const ExpoWorkspacePath = path.join(resourcesPath, SmokeTestsConstants.ExpoAppName);
const ExpoWorkspaceFilePath = path.join(ExpoWorkspacePath, SmokeTestsConstants.ApptsxFileName);
export const pureRNWorkspacePath = path.join(resourcesPath, SmokeTestsConstants.pureRNExpoApp);
const pureRNWorkspaceFilePath = path.join(pureRNWorkspacePath, SmokeTestsConstants.AppjsFileName);

export const artifactsPath = path.join(repoRoot, SmokeTestsConstants.artifactsDir);
const userDataDir = path.join(repoRoot, SmokeTestsConstants.VSCodeUserDataDir);

const extensionsPath = path.join(testVSCodeDirectory, "extensions");

function createOptions(quality: Quality, workspaceOrFolder: string, dataDirFolderName: string, extraArgs?: string[]): ApplicationOptions | null {
    if (!electronExecutablePath) {
        return null;
    }

    const logsDir = process.env.REACT_NATIVE_TOOLS_LOGS_DIR || artifactsPath;
    const loggers: Logger[] = [];

    loggers.push(new VSCodeConsoleLogger());
    const codePath = getBuildElectronPath(testVSCodeDirectory, isInsiders);
    ConsoleLogger.info(`*** Executing ${codePath}`);

    return {
        quality,
        codePath: codePath,
        workspacePath: workspaceOrFolder,
        userDataDir: path.join(userDataDir, dataDirFolderName),
        extensionsPath,
        waitTime: SmokeTestsConstants.elementResponseTimeout,
        logger: new MultiLogger(loggers),
        verbose: true,
        screenshotsPath: path.join(logsDir, "screenshots"),
        extraArgs: extraArgs,
    };
}

export function prepareReactNativeProjectForHermesTesting(): void {
    SetupEnvironmentHelper.prepareHermesReactNativeApplication(RNworkspaceFilePath, resourcesPath, RNworkspacePath, SmokeTestsConstants.RNAppName, "HermesReactNativeSample", process.env.RN_VERSION);
}

const testParams = TestConfigurator.parseTestArguments();
async function setup(): Promise<void> {
    ConsoleLogger.info(`*** Test VS Code directory: ${testVSCodeDirectory}`);
    ConsoleLogger.info("*** Preparing smoke tests setup...");

    AppiumHelper.runAppium();

    if (process.platform === "darwin") {
        await SetupEnvironmentHelper.runIosSimulator();
    }

    await AndroidEmulatorHelper.runAndroidEmulator();

    SetupEnvironmentHelper.prepareReactNativeApplication(RNworkspaceFilePath, resourcesPath, RNworkspacePath, SmokeTestsConstants.RNAppName, "ReactNativeSample", process.env.RN_VERSION);
    if (!testParams.RunBasicTests) {
        SetupEnvironmentHelper.prepareExpoApplication(ExpoWorkspaceFilePath, resourcesPath, ExpoWorkspacePath, SmokeTestsConstants.ExpoAppName, process.env.EXPO_SDK_MAJOR_VERSION);
        const PureRNVersionExpo = process.env.PURE_RN_VERSION || await SetupEnvironmentHelper.getLatestSupportedRNVersionForExpo(process.env.EXPO_SDK_MAJOR_VERSION);
        SetupEnvironmentHelper.prepareReactNativeApplication(pureRNWorkspaceFilePath, resourcesPath, pureRNWorkspacePath, SmokeTestsConstants.pureRNExpoApp, "PureRNExpoSample", PureRNVersionExpo);
        SetupEnvironmentHelper.addExpoDependencyToRNProject(pureRNWorkspacePath, process.env.PURE_EXPO_VERSION);
        await SetupEnvironmentHelper.installExpoAppOnAndroid();
        SetupEnvironmentHelper.patchExpoSettingsFile(ExpoWorkspacePath);
        if (process.platform === "darwin") {
            await SetupEnvironmentHelper.installExpoAppOnIos();
        }
    }

    const testVSCodeEXE = await VSCodeHelper.downloadVSCodeExecutable();

    electronExecutablePath = getBuildElectronPath(testVSCodeDirectory, isInsiders);
    if (!fs.existsSync(testVSCodeDirectory || "")) {
        await fail(`Can't find VS Code executable at ${testVSCodeDirectory}.`);
    }
    const testVSCodeExecutablePath = VSCodeHelper.getVSCodeExecutablePath(testVSCodeEXE);
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
        ConsoleLogger.warn(`*** EXPO_XDL_VERSION variable is not set, skipping installation of @expo/xdl package to the extension directory`);
    }

    if (!fs.existsSync(userDataDir)) {
        ConsoleLogger.info(`*** Creating VS Code user data directory: ${userDataDir}`);
        fs.mkdirSync(userDataDir);
    }
    ConsoleLogger.success("*** Smoke tests setup done!\n");
}

let runName = 0;
export async function runVSCode(workspaceOrFolder: string, locale?: string): Promise<Application> {
    runName++;
    const extensionLogsDir = path.join(artifactsPath, runName.toString(), "extensionLogs");
    const webdriverIOLogsDir = path.join(artifactsPath);
    process.env.REACT_NATIVE_TOOLS_LOGS_DIR = extensionLogsDir;
    process.env.WEBDRIVER_IO_LOGS_DIR = webdriverIOLogsDir;
    const options = createOptions(quality, workspaceOrFolder, runName.toString(), locale ? ["--locale", locale] : []);
    const app = new Application(options!);
    ConsoleLogger.info(`Options for run #${runName}: ${JSON.stringify(options, null, 2)}`);
    await app!.start();
    return app!;
}

before(async function () {
    if (testParams.SkipSetup) {
        ConsoleLogger.info("*** --skip-setup parameter is set, skipping clean up and apps installation");
        // Assume that VS Code is already installed
        electronExecutablePath = getBuildElectronPath(testVSCodeDirectory, isInsiders);
        return;
    }
    this.timeout(SmokeTestsConstants.smokeTestSetupAwaitTimeout);
    SetupEnvironmentHelper.cleanUp(path.join(testVSCodeDirectory, ".."), userDataDir, artifactsPath, [RNworkspacePath, ExpoWorkspacePath, pureRNWorkspacePath], SetupEnvironmentHelper.iOSExpoAppsCacheDir);
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
    setupLocalizationTests();
    if (process.platform === "darwin") {
        const noSelectArgs = !testParams.RunAndroidTests && !testParams.RunIosTests && !testParams.RunBasicTests;
        if (noSelectArgs) {
            ConsoleLogger.info("*** Android and iOS tests will be run");
            setupReactNativeDebugAndroidTests();
            setupReactNativeDebugiOSTests();
        } else if (testParams.RunBasicTests) {
            ConsoleLogger.info("*** --basic-only parameter is set, basic Android and iOS tests will be run");
            setupReactNativeDebugAndroidTests(testParams);
            setupReactNativeDebugiOSTests(testParams);
        } else if (testParams.RunAndroidTests) {
            ConsoleLogger.info("*** --android parameter is set, Android tests will be run");
            setupReactNativeDebugAndroidTests();
        } else if (testParams.RunIosTests) {
            ConsoleLogger.info("*** --ios parameter is set, iOS tests will be run");
            setupReactNativeDebugiOSTests();
        }
    } else {
        if (testParams.RunBasicTests) {
            ConsoleLogger.info("*** --basic-only parameter is set, basic Android tests will be run");
            setupReactNativeDebugAndroidTests(testParams);
        } else {
            setupReactNativeDebugAndroidTests();
        }
    }
});
