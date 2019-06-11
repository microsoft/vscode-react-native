// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.

import * as fs from "fs";
import { EnvConfigFilePath } from "../main";

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
    IOS_VERSION?: string;
    CODE_VERSION?: string;
    EXPO_XDL_VERSION?: string;
}

export class TestConfigurator {

    public static verifyEnvVariables(variables: TestEnvVariables) {
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
            console.warn("Optional EXPO_XDL_VERSION variable is not set");
        }
    }

    public static passEnvVariablesToProcessEnv(variables: TestEnvVariables) {
        const entries = Object.entries(variables);
        for (const entry of entries) {
            const variableName = entry[0];
            const variableValue = entry[1];
            process.env[variableName] = variableValue;
        }
    }

    public static setUpEnvVariables() {
        let variables;
        if (fs.existsSync(EnvConfigFilePath)) {
            console.log(`*** Config file "${EnvConfigFilePath}" is found, reading variables from there`);
            variables = JSON.parse(fs.readFileSync(EnvConfigFilePath).toString());
        } else {
            console.log(`*** Config file "${EnvConfigFilePath}" doesn't exist, looking at environment variables from process context...`);
            variables = process.env;
        }

        this.verifyEnvVariables(variables);
        this.passEnvVariablesToProcessEnv(variables);
    }

    public static printEnvVariableConfiguration() {
        let initLog: string = "";
        initLog += `ANDROID_EMULATOR = ${process.env.ANDROID_EMULATOR}\n`;
        initLog += `ANDROID_VERSION = ${process.env.ANDROID_VERSION}\n`;
        initLog += `IOS_SIMULATOR = ${process.env.IOS_SIMULATOR}\n`;
        initLog += `IOS_VERSION = ${process.env.IOS_VERSION}\n`;
        initLog += `CODE_VERSION = ${process.env.CODE_VERSION}\n`;
        initLog += `EXPO_XDL_VERSION = ${process.env.EXPO_XDL_VERSION}\n`;
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
