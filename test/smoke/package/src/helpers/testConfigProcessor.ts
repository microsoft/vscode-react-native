// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.
import * as fs from "fs";
import { SmokeTestLogger } from "./smokeTestLogger";

export interface TestRunArguments {
    RunAndroidTests: boolean;
    RunIosTests: boolean;
    RunMacOSTests: boolean;
    RunWindowsTests: boolean;
    SkipUnstableTests: boolean;
    RunBasicTests: boolean;
    SkipSetup: boolean;
    DontDeleteVSIX: boolean;
    UseCachedApplications: boolean;
}

interface TestEnvVariables {
    ANDROID_EMULATOR?: string;
    ANDROID_VERSION?: string;
    IOS_SIMULATOR?: string;
    IOS_VERSION?: string;
    CODE_VERSION?: string;
    EXPO_XDL_VERSION?: string;
    EXPO_SDK_MAJOR_VERSION?: string;
    RN_VERSION?: string;
    PURE_RN_VERSION?: string;
    PURE_EXPO_VERSION?: string;
    RN_MAC_OS_VERSION?: string;
    RNW_VERSION?: string;
}

export class TestConfigProcessor {
    private configVariables: TestEnvVariables;

    constructor(envConfigFilePath: string, envConfigFilePathDev?: string) {
        SmokeTestLogger.projectInstallLog(`*** Setting up configuration variables`);
        const config = this.readConfiguration(envConfigFilePath, envConfigFilePathDev);
        this.configVariables = this.getConfiguration(config);
        this.passEnvVariablesToProcessEnv(this.configVariables);
        this.printEnvVariableConfiguration();
    }

    private readConfiguration(envConfigFilePath: string, envConfigFilePathDev?: string): any {
        let configPath = "";
        if (envConfigFilePathDev && fs.existsSync(envConfigFilePathDev)) {
            configPath = envConfigFilePathDev;
        } else if (fs.existsSync(envConfigFilePath)) {
            configPath = envConfigFilePath;
        } else {
            throw new Error("Could not find config file.");
        }

        return JSON.parse(fs.readFileSync(configPath).toString());
    }

    private getConfiguration(variables: any): TestEnvVariables {
        // Hack for Azure DevOps, because it doesn't implicitly support optional parameters for task group
        if (variables.EXPO_XDL_VERSION === "skip") {
            delete variables.EXPO_XDL_VERSION;
        }
        if (variables.EXPO_SDK_MAJOR_VERSION === "skip") {
            delete variables.EXPO_SDK_MAJOR_VERSION;
        }
        if (variables.RN_VERSION === "skip") {
            delete variables.RN_VERSION;
        }
        if (variables.PURE_RN_VERSION === "skip") {
            delete variables.PURE_RN_VERSION;
        }
        if (variables.PURE_EXPO_VERSION === "skip") {
            delete variables.PURE_EXPO_VERSION;
        }

        this.verifyEnvVariables(variables);
        return variables;
    }

    private verifyEnvVariables(variables: TestEnvVariables) {
        if (!variables.ANDROID_EMULATOR) {
            throw new Error(`Missing ANDROID_EMULATOR variable`);
        }
        if (!variables.ANDROID_VERSION) {
            throw new Error(`Missing ANDROID_VERSION variable`);
        }
        if (process.platform === "darwin") {
            if (!variables.IOS_SIMULATOR) {
                throw new Error(`Missing IOS_SIMULATOR variable`);
            }
            if (!variables.IOS_VERSION) {
                throw new Error(`Missing IOS_VERSION variable`);
            }
        }
        if (!variables.CODE_VERSION) {
            throw new Error(`Missing CODE_VERSION variable`);
        }
        if (!variables.EXPO_XDL_VERSION) {
            SmokeTestLogger.warn("Optional EXPO_XDL_VERSION variable is not set");
        }
        if (!variables.EXPO_SDK_MAJOR_VERSION) {
            SmokeTestLogger.warn(
                "Optional EXPO_SDK_MAJOR_VERSION variable is not set. Use latest.",
            );
        }
        if (!variables.RN_VERSION) {
            SmokeTestLogger.warn("Optional RN_VERSION variable is not set");
        }
        if (!variables.PURE_RN_VERSION) {
            SmokeTestLogger.warn("Optional PURE_RN_VERSION variable is not set");
        }
        if (!variables.PURE_EXPO_VERSION) {
            SmokeTestLogger.warn("Optional PURE_EXPO_VERSION variable is not set");
        }
        if (!variables.RN_MAC_OS_VERSION) {
            SmokeTestLogger.warn("Optional RN_MAC_OS_VERSION variable is not set");
        }
        if (!variables.RNW_VERSION) {
            SmokeTestLogger.warn("Optional PURE_EXPO_VERSION variable is not set");
        }
    }

    private passEnvVariablesToProcessEnv(variables: TestEnvVariables) {
        const entries = Object.entries(variables);
        for (const entry of entries) {
            const variableName = entry[0];
            const variableValue = entry[1];
            process.env[variableName] = variableValue;
        }
    }

    private printEnvVariableConfiguration() {
        let initLog: string = "";
        initLog += `ANDROID_EMULATOR = ${process.env.ANDROID_EMULATOR}\n`;
        initLog += `ANDROID_VERSION = ${process.env.ANDROID_VERSION}\n`;
        initLog += `IOS_SIMULATOR = ${process.env.IOS_SIMULATOR}\n`;
        initLog += `IOS_VERSION = ${process.env.IOS_VERSION}\n`;
        initLog += `CODE_VERSION = ${process.env.CODE_VERSION}\n`;
        initLog += `EXPO_XDL_VERSION = ${process.env.EXPO_XDL_VERSION}\n`;
        initLog += `EXPO_SDK_MAJOR_VERSION = ${process.env.EXPO_SDK_MAJOR_VERSION}\n`;
        initLog += `RN_VERSION = ${process.env.RN_VERSION}\n`;
        initLog += `RNW_VERSION = ${process.env.RNW_VERSION}\n`;
        initLog += `PURE_RN_VERSION = ${process.env.PURE_RN_VERSION}\n`;
        initLog += `PURE_EXPO_VERSION = ${process.env.PURE_EXPO_VERSION}\n`;
        initLog += `RN_MAC_OS_VERSION = ${process.env.RN_MAC_OS_VERSION}\n`;
        SmokeTestLogger.projectInstallLog(initLog);
    }

    public parseTestArguments(): TestRunArguments {
        let config: TestRunArguments = {
            RunAndroidTests: process.argv.includes("--android"),
            RunIosTests: process.argv.includes("--ios"),
            RunWindowsTests: process.argv.includes("--windows"),
            RunMacOSTests: process.argv.includes("--macos"),
            RunBasicTests: process.argv.includes("--basic-only"),
            SkipSetup: process.argv.includes("--skip-setup"),
            DontDeleteVSIX: process.argv.includes("--dont-delete-vsix"),
            UseCachedApplications: process.argv.includes("--use-cache"),
            SkipUnstableTests: process.argv.includes("--skip-unstable-tests"),
        };

        if (
            !config.RunAndroidTests &&
            !config.RunIosTests &&
            !config.RunBasicTests &&
            !config.RunMacOSTests &&
            !config.RunWindowsTests
        ) {
            config.RunAndroidTests = true;
            config.RunIosTests = true;
            config.RunBasicTests = true;
            config.RunMacOSTests = true;
            config.RunWindowsTests = true;
        }

        return config;
    }
}
