// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.

import { ApplePlatformDebugModeManager } from "../applePlatformDebugModeManager";
import { PlistBuddy } from "./plistBuddy";
import { SimulatorPlist } from "./simulatorPlist";

export class IOSDebugModeManager extends ApplePlatformDebugModeManager {
    public static WEBSOCKET_EXECUTOR_NAME = "RCTWebSocketExecutor";
    private static EXECUTOR_CLASS_SETTING_NAME = ":RCTDevMenu:executorClass";

    private simulatorPlist: SimulatorPlist;

    constructor(iosProjectRoot: string, projectRoot: string, scheme?: string) {
        super(iosProjectRoot, projectRoot);
        this.projectRoot = projectRoot;
        this.simulatorPlist = new SimulatorPlist(
            this.platformProjectRoot,
            this.projectRoot,
            scheme,
        );
    }

    public setAppRemoteDebuggingSetting(
        enable: boolean,
        configuration?: string,
        productName?: string,
    ): Promise<void> {
        const plistBuddy = new PlistBuddy();

        // Find the plistFile with the configuration setting
        // There is a race here between us checking for the plist file, and the application starting up.
        return this.findPListFileWithRetry(configuration, productName).then((plistFile: string) => {
            // Set the executorClass to be RCTWebSocketExecutor so on the next startup it will default into debug mode
            // This is approximately equivalent to clicking the "Debug in Chrome" button

            return (enable
                ? plistBuddy.setPlistProperty(
                      plistFile,
                      IOSDebugModeManager.EXECUTOR_CLASS_SETTING_NAME,
                      IOSDebugModeManager.WEBSOCKET_EXECUTOR_NAME,
                  )
                : plistBuddy.deletePlistProperty(
                      plistFile,
                      IOSDebugModeManager.EXECUTOR_CLASS_SETTING_NAME,
                  )
            ).then(() =>
                plistBuddy.setPlistBooleanProperty(
                    plistFile,
                    IOSDebugModeManager.REMOTE_DEBUGGING_SETTING_NAME,
                    enable,
                ),
            );
        });
    }

    public getAppRemoteDebuggingSetting(
        configuration?: string,
        productName?: string,
    ): Promise<boolean> {
        return this.findPListFileWithRetry(configuration, productName).then((plistFile: string) => {
            // Attempt to read from the file, but if the property is not defined then return the empty string
            return Promise.all([
                new PlistBuddy().readPlistProperty(
                    plistFile,
                    IOSDebugModeManager.EXECUTOR_CLASS_SETTING_NAME,
                ),
                new PlistBuddy().readPlistProperty(
                    plistFile,
                    IOSDebugModeManager.REMOTE_DEBUGGING_SETTING_NAME,
                ),
            ])
                .then(([executorClassName, remoteDebugEnabled]) => {
                    return (
                        executorClassName === IOSDebugModeManager.WEBSOCKET_EXECUTOR_NAME &&
                        remoteDebugEnabled === "true"
                    );
                })
                .catch(() => false);
        });
    }

    protected tryOneAttemptToFindPListFile(
        configuration?: string,
        productName?: string,
    ): Promise<string> {
        return this.simulatorPlist.findPlistFile(configuration, productName).catch(reason => {
            this.logger.debug(`Failed one attempt to find plist file: ${reason}`);
            return "";
        });
    }
}
