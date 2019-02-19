// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.

import * as wdio from "webdriverio";
import * as setupEnvironmentHelper from "./setupEnvironmentHelper";

const androidVersion = "9.0";
const waitTime = 20000;
export async function setupExpoApp(expoAppURL: string, expoAppAPKPath: string) {

    const opts = {
    desiredCapabilities: {
        browserName: "",
        platformName: "Android",
        platformVersion: androidVersion,
        deviceName: setupEnvironmentHelper.androidEmulatorName,
        app: expoAppAPKPath,
        automationName: "UiAutomator2"
    },
    port: 4723,
    host: "localhost",
    };

    const client = wdio.remote(opts);
    await client.init()
    .waitForExist("//android.widget.Button[@content-desc='Explore']", waitTime)
    .click("//android.widget.Button[@content-desc='Explore']");
}