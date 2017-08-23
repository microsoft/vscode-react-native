// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.

import * as Q from "q";
import * as path from "path";

import {Log} from "../../common/log/log";
import {ChildProcess} from "../../common/node/childProcess";
import {CommandExecutor} from "../../common/commandExecutor";
import {GeneralMobilePlatform} from "../../common/generalMobilePlatform";
import {IIOSRunOptions} from "../../common/launchArgs";
import {PlistBuddy} from "../../common/ios/plistBuddy";
import {IOSDebugModeManager} from "../../common/ios/iOSDebugModeManager";
import {OutputVerifier, PatternToFailure} from "../../common/outputVerifier";
import {RemoteExtension} from "../../common/remoteExtension";

/* tslint:disable:no-var-requires */
const ErrorStrings = require("../../../errorStrings/errorStrings.json");
/* tslint:enable:no-var-requires */

export class IOSPlatform extends GeneralMobilePlatform {
    public static DEFAULT_IOS_PROJECT_RELATIVE_PATH = "ios";
    public static DEFAULT_IOS_SIMULATOR_TARGET = "iPhone 5";

    private static deviceString = "device";
    private static simulatorString = "simulator";

    private plistBuddy = new PlistBuddy();
    private target: string = "";
    private targetType: string = "simulator";
    private iosProjectRoot: string;

    // We should add the common iOS build/run erros we find to this list
    private static RUN_IOS_FAILURE_PATTERNS: PatternToFailure[] = [{
        pattern: "No devices are booted",
        message: ErrorStrings.IOSSimulatorNotLaunchable,
    }, {
        pattern: "FBSOpenApplicationErrorDomain",
        message: ErrorStrings.IOSSimulatorNotLaunchable,
    }, {
        pattern: "ios-deploy",
        message: ErrorStrings.IOSDeployNotFound,
    }];

    private static RUN_IOS_SUCCESS_PATTERNS = ["BUILD SUCCEEDED"];

    // We set remoteExtension = null so that if there is an instance of iOSPlatform that wants to have it's custom remoteExtension it can. This is specifically useful for tests.
    constructor(protected runOptions: IIOSRunOptions, { remoteExtension = undefined }: {remoteExtension?: RemoteExtension} = {}) {
        super(runOptions, { remoteExtension: remoteExtension });

        if (this.runOptions.targetType) {
            if (this.runOptions.targetType !== IOSPlatform.simulatorString &&
                this.runOptions.targetType !== IOSPlatform.deviceString) {
                throw Error(`Invalid Run iOS targetType: '${this.runOptions.targetType}' in .vscode/launch.json.` +
                    "Please use 'simulator' or 'device' targetType instead");
            }
        }

        if (this.runOptions.iosRelativeProjectPath) { // Deprecated option
            Log.logMessage("'iosRelativeProjectPath' option is deprecated. Please use 'native_folder' instead");
            this.runOptions.native_folder = this.runOptions.native_folder || this.runOptions.iosRelativeProjectPath;
        }

        this.iosProjectRoot = path.join(this.projectPath, this.runOptions.native_folder || "");

        if (this.runOptions.target === IOSPlatform.simulatorString) {
            this.targetType = this.runOptions.target;
            this.target = IOSPlatform.DEFAULT_IOS_SIMULATOR_TARGET;
            return;
        }

        if (this.runOptions.target === IOSPlatform.deviceString) {
            this.targetType = this.runOptions.target;
            this.target = "";
            return;
        }

        this.targetType = this.runOptions.targetType || IOSPlatform.simulatorString;
        if (this.runOptions.target) {
            this.target = this.runOptions.target;
        } else if (this.targetType === IOSPlatform.simulatorString) {
            this.target = IOSPlatform.DEFAULT_IOS_SIMULATOR_TARGET;
        } else {
            this.target = "";
        }
    }

    public runApp(): Q.Promise<void> {
        // Compile, deploy, and launch the app on either a simulator or a device
        const runArguments = this.getRunArgument();

        const runIosSpawn = new CommandExecutor(this.projectPath).spawnReactCommand("run-ios", runArguments);
        return new OutputVerifier(
            () =>
                this.generateSuccessPatterns(),
            () =>
                Q(IOSPlatform.RUN_IOS_FAILURE_PATTERNS)).process(runIosSpawn);
    }

    public enableJSDebuggingMode(): Q.Promise<void> {
        // Configure the app for debugging
        if (this.targetType === IOSPlatform.deviceString) {
            // Note that currently we cannot automatically switch the device into debug mode.
            Log.logMessage("Application is running on a device, please shake device and select 'Debug in Chrome' to enable debugging.");
            return Q.resolve<void>(void 0);
        }

        const iosDebugModeManager = new IOSDebugModeManager(this.iosProjectRoot);

        // Wait until the configuration file exists, and check to see if debugging is enabled
        return Q.all<boolean | string>([
            iosDebugModeManager.getSimulatorRemoteDebuggingSetting(),
            this.getBundleId(),
        ])
            .spread((debugModeEnabled: boolean, bundleId: string) => {
                if (debugModeEnabled) {
                    return Q.resolve(void 0);
                }

                // Debugging must still be enabled
                // We enable debugging by writing to a plist file that backs a NSUserDefaults object,
                // but that file is written to by the app on occasion. To avoid races, we shut the app
                // down before writing to the file.
                const childProcess = new ChildProcess();

                return childProcess.execToString("xcrun simctl spawn booted launchctl list")
                    .then((output: string) => {
                        // Try to find an entry that looks like UIKitApplication:com.example.myApp[0x4f37]
                        const regex = new RegExp(`(\\S+${bundleId}\\S+)`);
                        const match = regex.exec(output);

                        // If we don't find a match, the app must not be running and so we do not need to close it
                        return match ? childProcess.exec(`xcrun simctl spawn booted launchctl stop ${match[1]}`) : null;
                    })
                    .then(() => {
                        // Write to the settings file while the app is not running to avoid races
                        return iosDebugModeManager.setSimulatorRemoteDebuggingSetting(/*enable=*/ true);
                    })
                    .then(() => {
                        // Relaunch the app
                        return this.runApp();
                    });
            });
    }

    public prewarmBundleCache(): Q.Promise<void> {
        return this.remoteExtension.prewarmBundleCache(this.platformName);
    }

    public getRunArgument(): string[] {
        let runArguments: string[] = [];
        if (this.targetType) {
            runArguments.push(`--${this.targetType}`);
        }

        if (this.target) {
            runArguments.push(this.target);
        }

        if (this.runOptions.native_folder) {
            runArguments.push("--project-path", this.runOptions.native_folder);
        }

        // provide any defined scheme
        if (this.runOptions.scheme) {
            runArguments.push("--scheme", this.runOptions.scheme);
        }

        return runArguments;
    }

    private generateSuccessPatterns(): Q.Promise<string[]> {
        return this.getBundleId().then(bundleId =>
            IOSPlatform.RUN_IOS_SUCCESS_PATTERNS.concat([`Launching ${bundleId}\n${bundleId}: `]));
    }

    private getBundleId(): Q.Promise<string> {
        return this.plistBuddy.getBundleId(this.iosProjectRoot);
    }
}
