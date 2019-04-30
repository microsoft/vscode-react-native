import * as fs from "fs";

// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.

export function parseConfig(configFilePath: string) {
    if (fs.existsSync(configFilePath)) {
        const config = JSON.parse(fs.readFileSync(configFilePath).toString());
        if (config.ANDROID_EMULATOR) {
            process.env.ANDROID_EMULATOR = config.ANDROID_EMULATOR;
        }
        if (config.IOS_SIMULATOR) {
            process.env.IOS_SIMULATOR = config.IOS_SIMULATOR;
        }
        if (config.ANDROID_VERSION) {
            process.env.ANDROID_VERSION = config.ANDROID_VERSION;
        }
        if (config.IOS_VERSION) {
            process.env.IOS_VERSION = config.IOS_VERSION;
        }
        if (config.CODE_VERSION) {
            process.env.CODE_VERSION = config.CODE_VERSION;
        }
    } else {
        throw new Error("Config file is not found");
    }
}
