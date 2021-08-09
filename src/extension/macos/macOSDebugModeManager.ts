// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.

import * as path from "path";
import { homedir } from "os";
import { ApplePlatformDebugModeManager } from "../applePlatformDebugModeManager";
import { PlistBuddy } from "../ios/plistBuddy";
import { FileSystem } from "../../common/node/fileSystem";
import { PlatformType } from "../launchArgs";
import { DefaultsHelper } from "./defaultsHelper";

export class MacOSDebugModeManager extends ApplePlatformDebugModeManager {
    protected static REMOTE_DEBUGGING_FLAG_NAME = "isDebuggingRemotely";

    private scheme?: string;
    private nodeFileSystem: FileSystem;
    private plistBuddy: PlistBuddy;
    private defaultsHelper: DefaultsHelper;

    constructor(
        macosProjectRoot: string,
        projectRoot: string,
        scheme?: string,
        { nodeFileSystem = new FileSystem(), plistBuddy = undefined } = {},
    ) {
        super(macosProjectRoot, projectRoot);
        this.scheme = scheme;
        this.nodeFileSystem = nodeFileSystem;
        this.plistBuddy = plistBuddy || new PlistBuddy();
        this.defaultsHelper = new DefaultsHelper();
    }

    public setAppRemoteDebuggingSetting(
        enable: boolean,
        configuration?: string,
        productName?: string,
    ): Promise<void> {
        // Find the plistFile with the configuration setting
        // There is a race here between us checking for the plist file, and the application starting up.
        return this.findPListFileWithRetry(configuration, productName).then((plistFile: string) => {
            // Set the "isDebuggingRemotely" flag to "true", so on the next startup the application will default into debug mode
            // This is approximately equivalent to clicking the "Debug in Chrome" button
            return this.defaultsHelper.setPlistBooleanProperty(
                plistFile,
                MacOSDebugModeManager.REMOTE_DEBUGGING_FLAG_NAME,
                enable,
            );
        });
    }

    public getAppRemoteDebuggingSetting(
        configuration?: string,
        productName?: string,
    ): Promise<boolean> {
        return this.findPListFileWithRetry(configuration, productName).then((plistFile: string) => {
            // Attempt to read from the file, but if the property is not defined then return the empty string
            return this.plistBuddy
                .readPlistProperty(plistFile, MacOSDebugModeManager.REMOTE_DEBUGGING_SETTING_NAME)
                .then(remoteDebugEnabled => {
                    return remoteDebugEnabled === "true";
                })
                .catch(() => false);
        });
    }

    protected tryOneAttemptToFindPListFile(
        configuration?: string,
        productName?: string,
    ): Promise<string> {
        return this.findPlistFile(configuration, productName).catch(reason => {
            this.logger.debug(`Failed one attempt to find plist file: ${reason}`);
            return "";
        });
    }

    private findPlistFile(configuration?: string, productName?: string): Promise<string> {
        return this.plistBuddy
            .getBundleId(
                this.platformProjectRoot,
                this.projectRoot,
                PlatformType.macOS,
                false,
                configuration,
                productName,
                this.scheme,
            ) // Find the name of the application
            .then(bundleId => {
                const plistFilePath = path.join(
                    homedir(),
                    "Library",
                    "Preferences",
                    `${bundleId}.plist`,
                );
                return this.nodeFileSystem.exists(plistFilePath).then((exist: boolean) => {
                    if (!exist) {
                        throw new Error(`Unable to find plist file for ${bundleId}`);
                    } else {
                        return plistFilePath;
                    }
                });
            });
    }
}
