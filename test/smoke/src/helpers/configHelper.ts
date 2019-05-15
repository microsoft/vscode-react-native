// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.

import * as fs from "fs";

export interface TestRunArguments {
    RunAndroidTests: boolean;
    RuniOSTests: boolean;
    SkipTestsSetup: boolean;
}

export interface TestEnvVariables {
    android: {
        ANDROID_EMULATOR: string;
        ANDROID_VERSION: string;
    }
    ios?: {
        IOS_SIMULATOR: string;
        IOS_VERSION: string;
    }
    CODE_VERSION: string;
}

export class TestConfigurator {
    // Read json file with env variables for the test
    public static readTestEnvVariables(configFilePath: string) {
        const config = this.parseConfigFile(configFilePath);
        if (config) {
            if (config.ios) {
                process.env.IOS_SIMULATOR = config.ios.IOS_SIMULATOR;
                process.env.IOS_VERSION = config.ios.IOS_VERSION;
            }
            process.env.ANDROID_EMULATOR = config.android.ANDROID_EMULATOR;
            process.env.ANDROID_VERSION = config.android.ANDROID_VERSION;
            process.env.CODE_VERSION = config.CODE_VERSION;
        }

        // If config file is absent - use standard env variables if defined
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

    private static parseConfigFile(configFilePath: string): TestEnvVariables | null {
        if (fs.existsSync(configFilePath)) {
            const config = JSON.parse(fs.readFileSync(configFilePath).toString());

            let android;
            if (config.ANDROID_EMULATOR && config.ANDROID_VERSION) {
                android = {
                    ANDROID_EMULATOR: config.ANDROID_EMULATOR,
                    ANDROID_VERSION: config.ANDROID_VERSION,
                }
            } else {
                throw "Incorrect config: absent Android fields"
            }

            let ios;
            if (process.platform === "darwin") {
                if (config.IOS_SIMULATOR && config.IOS_VERSION) {
                    ios = {
                        IOS_SIMULATOR: config.IOS_SIMULATOR,
                        IOS_VERSION: config.IOS_VERSION,
                    }
                } else {
                    throw "Incorrect config: absent iOS fields"
                }
            }

            let CODE_VERSION;
            if (config.CODE_VERSION) {
                CODE_VERSION = config.CODE_VERSION;
            } else {
                throw "Incorrect config: absent VS Code version field"
            }

            return {
                android: android,
                ios: ios,
                CODE_VERSION: CODE_VERSION,
            };
        } else {
            return null;
        }
    }
}
