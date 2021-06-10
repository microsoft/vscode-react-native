// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.

import { OutputChannelLogger } from "./log/OutputChannelLogger";
import { PromiseUtil } from "../common/node/promise";
import * as nls from "vscode-nls";
nls.config({
    messageFormat: nls.MessageFormat.bundle,
    bundleFormat: nls.BundleFormat.standalone,
})();
const localize = nls.loadMessageBundle();

export abstract class ApplePlatformDebugModeManager {
    protected static REMOTE_DEBUGGING_SETTING_NAME = ":RCTDevMenu:isDebuggingRemotely";
    protected logger: OutputChannelLogger = OutputChannelLogger.getMainChannel();
    protected static MAX_RETRIES = 5;
    protected static DELAY_UNTIL_RETRY = 2000;

    protected projectRoot: string;
    protected platformProjectRoot: string;

    constructor(platformProjectRoot: string, projectRoot: string) {
        this.projectRoot = projectRoot;
        this.platformProjectRoot = platformProjectRoot;
    }

    public abstract setAppRemoteDebuggingSetting(
        enable: boolean,
        configuration?: string,
        productName?: string,
    ): Promise<void>;

    public abstract getAppRemoteDebuggingSetting(
        configuration?: string,
        productName?: string,
    ): Promise<boolean>;

    public findPListFileWithRetry(configuration?: string, productName?: string): Promise<string> {
        const pu = new PromiseUtil();
        const failureString = localize(
            "UnableToFindPlistFileToConfigureDebugging",
            "Unable to find plist file to configure debugging",
        );

        return pu.retryAsync(
            () => this.tryOneAttemptToFindPListFile(configuration, productName), // Operation to retry until successful
            (file: string) => file !== "", // Condition to check if the operation was successful, and this logic is done
            ApplePlatformDebugModeManager.MAX_RETRIES,
            ApplePlatformDebugModeManager.DELAY_UNTIL_RETRY,
            failureString,
        ); // Error to show in case all retries fail
    }

    protected abstract tryOneAttemptToFindPListFile(
        configuration?: string,
        productName?: string,
    ): Promise<string>;
}
