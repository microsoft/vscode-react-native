// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.

import * as wdio from "webdriverio";
import * as setupEnvironmentHelper from "./setupEnvironmentHelper";
import * as clipboardy from "clipboardy";

const emulatorAndroidVersion = "9.0";
const waitTime = 20000;
// Android UI elements
const EXPO_OPEN_FROM_CLIPBOARD = "//*[@text='Open from Clipboard']";

export async function setupExpoAppAndroid(expoAppURL: string, expoAppAPKPath: string) {
    const opts = {
        desiredCapabilities: {
            browserName: "",
            platformName: "Android",
            platformVersion: emulatorAndroidVersion,
            deviceName: setupEnvironmentHelper.androidEmulatorName,
            app: expoAppAPKPath,
            automationName: "UiAutomator2"
        },
        port: 4723,
        host: "localhost",
    };
    clipboardy.writeSync(expoAppURL);
    const client = wdio.remote(opts);
    await client.init()
    .waitForExist(EXPO_OPEN_FROM_CLIPBOARD, waitTime)
    .click(EXPO_OPEN_FROM_CLIPBOARD);
}
