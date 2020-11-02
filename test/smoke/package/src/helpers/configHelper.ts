// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.

import * as fs from "fs";
import { IosSimulatorHelper } from "./iosSimulatorHelper";

export interface TestRunArguments {
    RunAndroidTests: boolean;
    RunIosTests: boolean;
    RunBasicTests: boolean;
    SkipSetup: boolean;
    DontDeleteVSIX: boolean;
}

export interface TestEnvVariables {
    ANDROID_EMULATOR?: string;
    ANDROID_VERSION?: string;
    IOS_SIMULATOR?: string;
    IOS_SIMULATOR_UDID?: string;
    IOS_VERSION?: string;
    CODE_VERSION?: string;
    EXPO_XDL_VERSION?: string;
    EXPO_SDK_MAJOR_VERSION?: string;
    RN_VERSION?: string;
    PURE_RN_VERSION?: string;
    PURE_EXPO_VERSION?: string;
    RNW_VERSION?: string;
}

export class TestConfigurator {

    public static verifyEnvVariables(variables: TestEnvVariables): void {
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
            if (!variables.IOS_SIMULATOR_UDID) {
                throw new Error(`Couldn't find udid for the iOS simulator ${variables.IOS_SIMULATOR}`);
            }
            if (!variables.IOS_VERSION) {
                throw new Error(`Missing IOS_VERSION variable`);
            }
        }
        if (!variables.CODE_VERSION) {
            throw new Error(`Missing CODE_VERSION variable`);
        }
        if (!variables.EXPO_XDL_VERSION) {
            console.warn("Optional EXPO_XDL_VERSION variable is not set");
        }
        if (!variables.EXPO_SDK_MAJOR_VERSION) {
            console.warn("Optional EXPO_SDK_MAJOR_VERSION variable is not set. Use latest.");
        }
        if (!variables.RN_VERSION) {
            console.warn("Optional RN_VERSION variable is not set");
        }
        if (!variables.PURE_RN_VERSION) {
            console.warn("Optional PURE_RN_VERSION variable is not set");
        }
        if (!variables.PURE_EXPO_VERSION) {
            console.warn("Optional PURE_EXPO_VERSION variable is not set");
        }
        if (!variables.RNW_VERSION) {
            console.warn("Optional PURE_EXPO_VERSION variable is not set");
        }
    }

    public static passEnvVariablesToProcessEnv(variables: TestEnvVariables): void {
        const entries = Object.entries(variables);
        for (const entry of entries) {
            const variableName = entry[0];
            const variableValue = entry[1];
            process.env[variableName] = variableValue;
        }
    }

    public static setUpEnvVariables(envConfigFilePath: string): void {
        let variables: any;

        if (fs.existsSync(envConfigFilePath)) {
            console.log(`*** Config file "${envConfigFilePath}" is found, reading variables from there`);
            variables = JSON.parse(fs.readFileSync(envConfigFilePath).toString());
        }

        if (variables.IOS_SIMULATOR && process.platform === "darwin") {
            const simulator = IosSimulatorHelper.getSimulator(variables.IOS_SIMULATOR);
            variables.IOS_SIMULATOR_UDID = simulator?.id;
        }

        // Hack for Azure DevOps, because it doesn't implicitly support optional parameters for task group
        if (variables.EXPO_XDL_VERSION === "skip") {
            delete variables.EXPO_XDL_VERSION;
        }
        if (variables.EXPO_SDK_MAJOR_VERSION === "skip") {
            delete variables.EXPO_SDK_MAJOR_VERSION;
        }
        if (variables.RN_VERSION === "skip" || process.env.NIGHTLY) {
            delete variables.RN_VERSION;
        }
        if (variables.PURE_RN_VERSION === "skip" || process.env.NIGHTLY) {
            delete variables.PURE_RN_VERSION;
        }
        if (variables.PURE_EXPO_VERSION === "skip" || process.env.NIGHTLY) {
            delete variables.PURE_EXPO_VERSION;
        }
        if (variables.RNW_VERSION === "skip" || process.env.NIGHTLY) {
            delete variables.RNW_VERSION;
        }

        this.verifyEnvVariables(variables);
        this.passEnvVariablesToProcessEnv(variables);
    }

    public static printEnvVariableConfiguration(): void {
        let initLog: string = "";
        initLog += `ANDROID_EMULATOR = ${process.env.ANDROID_EMULATOR}\n`;
        initLog += `ANDROID_VERSION = ${process.env.ANDROID_VERSION}\n`;
        initLog += `IOS_SIMULATOR = ${process.env.IOS_SIMULATOR}\n`;
        initLog += `IOS_SIMULATOR_UDID = ${process.env.IOS_SIMULATOR_UDID}\n`;
        initLog += `IOS_VERSION = ${process.env.IOS_VERSION}\n`;
        initLog += `CODE_VERSION = ${process.env.CODE_VERSION}\n`;
        initLog += `EXPO_XDL_VERSION = ${process.env.EXPO_XDL_VERSION}\n`;
        initLog += `EXPO_SDK_MAJOR_VERSION = ${process.env.EXPO_SDK_MAJOR_VERSION}\n`;
        initLog += `RN_VERSION = ${process.env.RN_VERSION}\n`;
        initLog += `RNW_VERSION = ${process.env.RNW_VERSION}\n`;
        initLog += `PURE_RN_VERSION = ${process.env.PURE_RN_VERSION}\n`;
        initLog += `PURE_EXPO_VERSION = ${process.env.PURE_EXPO_VERSION}\n`;
        console.log(initLog);
    }

    public static parseTestArguments(): TestRunArguments {
        return {
            RunAndroidTests: process.argv.includes("--android"),
            RunIosTests: process.argv.includes("--ios"),
            RunBasicTests: process.argv.includes("--basic-only"),
            SkipSetup: process.argv.includes("--skip-setup"),
            DontDeleteVSIX: process.argv.includes("--dont-delete-vsix"),
        };
    }
}
