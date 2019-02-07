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
    console.log(`*** Copying ${expoAppURL} to system clipboard`);
    // Expo application automatically detects Expo URLs in the clipboard
    // So we are copying expoAppURL to system clipboard and click on the special "Open from Clipboard" UI element
    clipboardy.writeSync(expoAppURL);

    console.log(`*** Initializing WebdriverIO with options:/n ${opts}`);
    // Connect to the Android emulator with predefined opts
    const client = wdio.remote(opts);

    console.log(`*** Running WebdriverIO...`);
    // Install application on emulator and run Expo app by expoAppURL
    await client.init()
    .waitForExist(EXPO_OPEN_FROM_CLIPBOARD, waitTime)
    .click(EXPO_OPEN_FROM_CLIPBOARD);
}
