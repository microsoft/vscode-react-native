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

    public async setAppRemoteDebuggingSetting(
        enable: boolean,
        configuration?: string,
        productName?: string,
    ): Promise<void> {
        const plistBuddy = new PlistBuddy();

        // Find the plistFile with the configuration setting
        // There is a race here between us checking for the plist file, and the application starting up.
        const plistFile = await this.findPListFileWithRetry(configuration, productName);
        await (enable
            ? plistBuddy.setPlistProperty(
                  plistFile,
                  IOSDebugModeManager.EXECUTOR_CLASS_SETTING_NAME,
                  IOSDebugModeManager.WEBSOCKET_EXECUTOR_NAME,
              )
            : plistBuddy.deletePlistProperty(
                  plistFile,
                  IOSDebugModeManager.EXECUTOR_CLASS_SETTING_NAME,
              ));
        await plistBuddy.setPlistBooleanProperty(
            plistFile,
            IOSDebugModeManager.REMOTE_DEBUGGING_SETTING_NAME,
            enable,
        );
    }

    public async getAppRemoteDebuggingSetting(
        configuration?: string,
        productName?: string,
    ): Promise<boolean> {
        const plistFile = await this.findPListFileWithRetry(configuration, productName);
        try {
            const [executorClassName, remoteDebugEnabled] = await Promise.all([
                new PlistBuddy().readPlistProperty(
                    plistFile,
                    IOSDebugModeManager.EXECUTOR_CLASS_SETTING_NAME,
                ),
                new PlistBuddy().readPlistProperty(
                    plistFile,
                    IOSDebugModeManager.REMOTE_DEBUGGING_SETTING_NAME,
                ),
            ]);
            return (
                executorClassName === IOSDebugModeManager.WEBSOCKET_EXECUTOR_NAME &&
                remoteDebugEnabled === "true"
            );
        } catch (e) {
            return false;
        }
    }

    protected async tryOneAttemptToFindPListFile(
        configuration?: string,
        productName?: string,
    ): Promise<string> {
        try {
            return await this.simulatorPlist.findPlistFile(configuration, productName);
        } catch (reason) {
            this.logger.debug(`Failed one attempt to find plist file: ${reason}`);
            return "";
        }
    }
}
