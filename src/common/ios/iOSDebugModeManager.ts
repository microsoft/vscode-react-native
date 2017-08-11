// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.

import * as Q from "q";

import {Log} from "../../common/log/log";
import {LogLevel} from "../../common/log/logHelper";
import {PromiseUtil} from "../../common/node/promise";
import {PlistBuddy} from "./plistBuddy";
import {SimulatorPlist} from "./simulatorPlist";

export class IOSDebugModeManager {
    public static WEBSOCKET_EXECUTOR_NAME = "RCTWebSocketExecutor";
    private static EXECUTOR_CLASS_SETTING_NAME = ":RCTDevMenu:executorClass";
    private static REMOTE_DEBUGGING_SETTING_NAME = ":RCTDevMenu:isDebuggingRemotely";
    private static MAX_RETRIES = 5;
    private static DELAY_UNTIL_RETRY = 2000;

    private projectRoot: string;
    private simulatorPlist: SimulatorPlist;

    constructor(projectRoot: string) {
        this.projectRoot = projectRoot;
        this.simulatorPlist = new SimulatorPlist(this.projectRoot);
    }

    public setSimulatorRemoteDebuggingSetting(enable: boolean): Q.Promise<void> {
        const plistBuddy = new PlistBuddy();

        // Find the plistFile with the configuration setting
        // There is a race here between us checking for the plist file, and the application starting up.
        return this.findPListFile()
            .then((plistFile: string) => {
                // Set the executorClass to be RCTWebSocketExecutor so on the next startup it will default into debug mode
                // This is approximately equivalent to clicking the "Debug in Chrome" button

                return (enable
                    ? plistBuddy.setPlistProperty(plistFile, IOSDebugModeManager.EXECUTOR_CLASS_SETTING_NAME, IOSDebugModeManager.WEBSOCKET_EXECUTOR_NAME)
                    : plistBuddy.deletePlistProperty(plistFile, IOSDebugModeManager.EXECUTOR_CLASS_SETTING_NAME))
                    .then(() => plistBuddy.setPlistBooleanProperty(plistFile, IOSDebugModeManager.REMOTE_DEBUGGING_SETTING_NAME, enable));
            });
    }

    public getSimulatorRemoteDebuggingSetting(): Q.Promise<boolean> {
        return this.findPListFile()
            .then((plistFile: string) => {
                // Attempt to read from the file, but if the property is not defined then return the empty string
                return Q.all([
                    new PlistBuddy().readPlistProperty(plistFile, IOSDebugModeManager.EXECUTOR_CLASS_SETTING_NAME),
                    new PlistBuddy().readPlistProperty(plistFile, IOSDebugModeManager.REMOTE_DEBUGGING_SETTING_NAME),
                ])
                    .spread((executorClassName: string, remoteDebugEnabled: string) => {
                        return executorClassName === IOSDebugModeManager.WEBSOCKET_EXECUTOR_NAME
                            && remoteDebugEnabled === "true";
                    })
                    .catch(() => false);
            });
    }

    public findPListFile(): Q.Promise<string> {
        const pu = new PromiseUtil();
        const failureString = `Unable to find plist file to configure debugging`;

        return pu.retryAsync(
            () =>
                this.tryOneAttemptToFindPListFile(), // Operation to retry until successful
            (file: string) =>
                file !== "", // Condition to check if the operation was successful, and this logic is done
            IOSDebugModeManager.MAX_RETRIES,
            IOSDebugModeManager.DELAY_UNTIL_RETRY,
            failureString); // Error to show in case all retries fail
    }

    private tryOneAttemptToFindPListFile(): Q.Promise<string> {
        return this.simulatorPlist.findPlistFile().catch(reason => {
            Log.logInternalMessage(LogLevel.Info, `Failed one attempt to find plist file: ${reason}`);
            return "";
        });
    }
}
