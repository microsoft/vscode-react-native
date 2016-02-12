// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.

import * as Q from "q";

import {Log} from "../../common/log";
import {PromiseUtil} from "../../common/node/promise";
import {PlistBuddy} from "./plistBuddy";
import {SimulatorPlist} from "./simulatorPlist";

export class iOSDebugModeManager {
    private static EXECUTOR_CLASS_SETTING_NAME = ":RCTDevMenu:executorClass";
    private projectRoot: string;

    constructor(projectRoot: string) {
        this.projectRoot = projectRoot;
    }

    public setSimulatorJSDebuggingModeSetting(enable: boolean): Q.Promise<void> {
        const plistBuddy = new PlistBuddy();
        const simulatorPlist = new SimulatorPlist(this.projectRoot);
        const pu = new PromiseUtil();

        const actionText = enable ? "enable" : "disable";

        // Find the plistFile with the configuration setting
        // There is a race here between us checking for the plist file, and the application starting up.
        return pu.retryAsync(() => simulatorPlist.findPlistFile().catch((): string => null),
            (file: string) => file !== null, 5, 2000, `Unable to find plist file to ${actionText} debugging`)
            .then((plistFile: string) => {
                // Set the executorClass to be RCTWebSocketExecutor so on the next startup it will default into debug mode
                // This is approximately equivalent to clicking the "Debug in Chrome" button
                return enable
                    ? plistBuddy.setPlistProperty(plistFile, iOSDebugModeManager.EXECUTOR_CLASS_SETTING_NAME, "RCTWebSocketExecutor")
                    : plistBuddy.deletePlistProperty(plistFile, iOSDebugModeManager.EXECUTOR_CLASS_SETTING_NAME);
            });
    }
}
