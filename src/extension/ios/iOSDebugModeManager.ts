// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.

import { OutputChannelLogger } from "../log/OutputChannelLogger";
import { PromiseUtil } from "../../common/node/promise";
import { PlistBuddy } from "./plistBuddy";
import { SimulatorPlist } from "./simulatorPlist";
import * as nls from "vscode-nls";
nls.config({
    messageFormat: nls.MessageFormat.bundle,
    bundleFormat: nls.BundleFormat.standalone,
})();
const localize = nls.loadMessageBundle();

export class IOSDebugModeManager {
    public static WEBSOCKET_EXECUTOR_NAME = "RCTWebSocketExecutor";
    private static EXECUTOR_CLASS_SETTING_NAME = ":RCTDevMenu:executorClass";
    private static REMOTE_DEBUGGING_SETTING_NAME = ":RCTDevMenu:isDebuggingRemotely";
    private static MAX_RETRIES = 5;
    private static DELAY_UNTIL_RETRY = 2000;
    private logger: OutputChannelLogger = OutputChannelLogger.getMainChannel();

    private projectRoot: string;
    private iosProjectRoot: string;
    private simulatorPlist: SimulatorPlist;
    private nodeModulesRoot: string;

    constructor(
        iosProjectRoot: string,
        projectRoot: string,
        nodeModulesRoot: string,
        scheme?: string,
    ) {
        this.projectRoot = projectRoot;
        this.iosProjectRoot = iosProjectRoot;
        this.nodeModulesRoot = nodeModulesRoot;
        this.simulatorPlist = new SimulatorPlist(this.iosProjectRoot, this.projectRoot, scheme);
    }

    public setSimulatorRemoteDebuggingSetting(
        enable: boolean,
        configuration?: string,
        productName?: string,
    ): Promise<void> {
        const plistBuddy = new PlistBuddy(undefined, this.nodeModulesRoot);

        // Find the plistFile with the configuration setting
        // There is a race here between us checking for the plist file, and the application starting up.
        return this.findPListFile(configuration, productName).then((plistFile: string) => {
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

    public getSimulatorRemoteDebuggingSetting(
        configuration?: string,
        productName?: string,
    ): Promise<boolean> {
        return this.findPListFile(configuration, productName).then((plistFile: string) => {
            // Attempt to read from the file, but if the property is not defined then return the empty string
            return Promise.all([
                new PlistBuddy(undefined, this.nodeModulesRoot).readPlistProperty(
                    plistFile,
                    IOSDebugModeManager.EXECUTOR_CLASS_SETTING_NAME,
                ),
                new PlistBuddy(undefined, this.nodeModulesRoot).readPlistProperty(
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

    public findPListFile(configuration?: string, productName?: string): Promise<string> {
        const pu = new PromiseUtil();
        const failureString = localize(
            "UnableToFindPlistFileToConfigureDebugging",
            "Unable to find plist file to configure debugging",
        );

        return pu.retryAsync(
            () => this.tryOneAttemptToFindPListFile(configuration, productName), // Operation to retry until successful
            (file: string) => file !== "", // Condition to check if the operation was successful, and this logic is done
            IOSDebugModeManager.MAX_RETRIES,
            IOSDebugModeManager.DELAY_UNTIL_RETRY,
            failureString,
        ); // Error to show in case all retries fail
    }

    private tryOneAttemptToFindPListFile(
        configuration?: string,
        productName?: string,
    ): Promise<string> {
        return this.simulatorPlist.findPlistFile(configuration, productName).catch(reason => {
            this.logger.debug(`Failed one attempt to find plist file: ${reason}`);
            return "";
        });
    }
}
