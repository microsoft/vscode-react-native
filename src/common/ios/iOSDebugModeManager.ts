// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.

import * as Q from "q";

import {PromiseUtil} from "../../common/node/promise";
import {PlistBuddy} from "./plistBuddy";
import {SimulatorPlist} from "./simulatorPlist";

export class IOSDebugModeManager {
    public static WEBSOCKET_EXECUTOR_NAME = "RCTWebSocketExecutor";
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
        return this.findPListFile()
            .then((plistFile: string) => {
                // Set the executorClass to be RCTWebSocketExecutor so on the next startup it will default into debug mode
                // This is approximately equivalent to clicking the "Debug in Chrome" button
                return enable
                    ? plistBuddy.setPlistProperty(plistFile, IOSDebugModeManager.EXECUTOR_CLASS_SETTING_NAME, IOSDebugModeManager.WEBSOCKET_EXECUTOR_NAME)
                    : plistBuddy.deletePlistProperty(plistFile, IOSDebugModeManager.EXECUTOR_CLASS_SETTING_NAME);
            });
    }

    public getSimulatorJSDebuggingModeSetting(): Q.Promise<string> {
        return this.findPListFile().then((plistFile: string) => {
            // Attempt to read from the file, but if the property is not defined then return the empty string
            return new PlistBuddy().readPlistProperty(plistFile, IOSDebugModeManager.EXECUTOR_CLASS_SETTING_NAME)
                .catch(() => "");
        });
    }

    public findPListFile(): Q.Promise<string> {
        const pu = new PromiseUtil();
        const failureString = `Unable to find plist file to configure debugging`;

        return pu.retryAsync(
            () =>
                this.tryOneAttemptToFindPListFile(), // Operation to retry until succesful
            (file: string) =>
                file !== null, // Condition to check if the operation was succesful, and this logic is done
            IOSDebugModeManager.MAX_RETRIES,
            IOSDebugModeManager.DELAY_UNTIL_RETRY,
            failureString); // Error to show in case all retries fail
    }

    private tryOneAttemptToFindPListFile() {
        return this.simulatorPlist.findPlistFile().catch((): string => null);
    }
}
