// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.

import * as fs from "fs";

export interface TestRunArguments {
    RunAndroidTests: boolean;
    RuniOSTests: boolean;
    SkipTestsSetup: boolean;
}

export interface TestEnvVariables {
    ANDROID_EMULATOR: string;
    IOS_SIMULATOR: string;
    ANDROID_VERSION: string;
    IOS_VERSION: string;
    CODE_VERSION: string;
}

export class TestConfigurator {
    // Read json file with env variables for the test
    public static readTestEnvVariables(configFilePath: string) {
        const config = this.parseConfigFile(configFilePath);
        if (config.ANDROID_EMULATOR && !process.env.ANDROID_EMULATOR) {
            process.env.ANDROID_EMULATOR = config.ANDROID_EMULATOR;
        }
        if (config.IOS_SIMULATOR && !process.env.IOS_SIMULATOR) {
            process.env.IOS_SIMULATOR = config.IOS_SIMULATOR;
        }
        if (config.ANDROID_VERSION && !process.env.ANDROID_VERSION) {
            process.env.ANDROID_VERSION = config.ANDROID_VERSION;
        }
        if (config.IOS_VERSION && !process.env.IOS_VERSION) {
            process.env.IOS_VERSION = config.IOS_VERSION;
        }
        if (config.CODE_VERSION && !process.env.CODE_VERSION) {
            process.env.CODE_VERSION = config.CODE_VERSION;
        }
        this.printEnvVariableConfiguration();
    }

    public static parseTestArguments(): TestRunArguments {
        return {
            RunAndroidTests: process.argv.includes("--android"),
            RuniOSTests: process.argv.includes("--ios"),
            SkipTestsSetup: process.argv.includes("--skip-setup"),
        };
    }

    private static printEnvVariableConfiguration() {
        let initLog: string = "";
        initLog += `ANDROID_EMULATOR = ${process.env.ANDROID_EMULATOR}\n`;
        initLog += `IOS_SIMULATOR = ${process.env.IOS_SIMULATOR}\n`;
        initLog += `ANDROID_VERSION = ${process.env.ANDROID_VERSION}\n`;
        initLog += `IOS_VERSION = ${process.env.IOS_VERSION}\n`;
        initLog += `CODE_VERSION = ${process.env.CODE_VERSION}\n`;
        console.log(initLog);
    }

    private static parseConfigFile(configFilePath: string): TestEnvVariables {
        if (fs.existsSync(configFilePath)) {
            const config = JSON.parse(fs.readFileSync(configFilePath).toString());
            return {
                ANDROID_EMULATOR: config.ANDROID_EMULATOR,
                IOS_SIMULATOR: config.IOS_SIMULATOR,
                ANDROID_VERSION: config.ANDROID_VERSION,
                IOS_VERSION: config.IOS_VERSION,
                CODE_VERSION: config.CODE_VERSION,
            };
        } else {
            throw new Error("Config file is not found");
        }
    }
}
