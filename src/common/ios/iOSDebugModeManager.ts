// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.

import * as Q from "q";

import {PromiseUtil} from "../../common/node/promise";
import {PlistBuddy} from "./plistBuddy";
import {SimulatorPlist} from "./simulatorPlist";

export class IOSDebugModeManager {
    private static EXECUTOR_CLASS_SETTING_NAME = ":RCTDevMenu:executorClass";
    private static MAX_RETRIES = 5;
    private static DELAY_UNTIL_RETRY = 2000;

    private projectRoot: string;
    private simulatorPlist: SimulatorPlist;

    constructor(projectRoot: string) {
        this.projectRoot = projectRoot;
        this.simulatorPlist = new SimulatorPlist(this.projectRoot);
    }

    public setSimulatorJSDebuggingModeSetting(enable: boolean): Q.Promise<void> {
        const plistBuddy = new PlistBuddy();

        // Find the plistFile with the configuration setting
        // There is a race here between us checking for the plist file, and the application starting up.
        return this.findPListFile(enable)
            .then((plistFile: string) => {
                // Set the executorClass to be RCTWebSocketExecutor so on the next startup it will default into debug mode
                // This is approximately equivalent to clicking the "Debug in Chrome" button
                return enable
                    ? plistBuddy.setPlistProperty(plistFile, IOSDebugModeManager.EXECUTOR_CLASS_SETTING_NAME, "RCTWebSocketExecutor")
                    : plistBuddy.deletePlistProperty(plistFile, IOSDebugModeManager.EXECUTOR_CLASS_SETTING_NAME);
            });
    }

    private tryOneAttemptToFindPListFile() {
        return this.simulatorPlist.findPlistFile().catch((): string => null);
    }

    private findPListFile(enable: boolean): Q.Promise<string> {
        const pu = new PromiseUtil();
        const actionText = enable ? "enable" : "disable";

        const failureString = `Unable to find plist file to ${actionText} debugging`;

        return pu.retryAsync(
            () =>
                this.tryOneAttemptToFindPListFile(), // Operation to retry until succesful
            (file: string) =>
                file !== null, // Condition to check if the operation was succesful, and this logic is done
            IOSDebugModeManager.MAX_RETRIES,
            IOSDebugModeManager.DELAY_UNTIL_RETRY,
            failureString); // Error to show in case all retries fail
    }
}
