// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.

import * as Q from "q";
import * as path from "path";

import {Log} from "../../common/log/log";
import {ChildProcess} from "../../common/node/childProcess";
import {CommandExecutor} from "../../common/commandExecutor";
import {GeneralMobilePlatform} from "../generalMobilePlatform";
import {Compiler} from "./compiler";
import {DeviceDeployer} from "./deviceDeployer";
import {DeviceRunner} from "./deviceRunner";
import {IRunOptions} from "../../common/launchArgs";
import {PlistBuddy} from "../../common/ios/plistBuddy";
import {IOSDebugModeManager} from "../../common/ios/iOSDebugModeManager";
import {OutputVerifier, PatternToFailure} from "../../common/outputVerifier";

export class IOSPlatform extends GeneralMobilePlatform {
    public static DEFAULT_IOS_PROJECT_RELATIVE_PATH = "ios";

    private static deviceString = "device";
    private static simulatorString = "simulator";

    private plistBuddy = new PlistBuddy();

    private simulatorTarget: string;
    private isSimulator: boolean;
    private iosProjectPath: string;

    // We should add the common iOS build/run erros we find to this list
    private static RUN_IOS_FAILURE_PATTERNS: PatternToFailure = {
        "No devices are booted": "Unable to launch iOS simulator. Try specifying a different target.",
        "FBSOpenApplicationErrorDomain": "Unable to launch iOS simulator. Try specifying a different target.",
    };

    private static RUN_IOS_SUCCESS_PATTERNS = ["BUILD SUCCEEDED"];

    // We set remoteExtension = null so that if there is an instance of iOSPlatform that wants to have it's custom remoteExtension it can. This is specifically useful for tests.
    constructor(runOptions: IRunOptions, { remoteExtension = null } = {}) {
        super(runOptions, { remoteExtension: remoteExtension });
        this.simulatorTarget = this.runOptions.target || IOSPlatform.simulatorString;
        this.isSimulator = this.simulatorTarget.toLowerCase() !== IOSPlatform.deviceString;
        this.iosProjectPath = path.join(this.projectPath, this.runOptions.iosRelativeProjectPath);
    }

    public runApp(): Q.Promise<void> {
        // Compile, deploy, and launch the app on either a simulator or a device
        if (this.isSimulator) {
            // React native supports running on the iOS simulator from the command line
            let runArguments: string[] = [];
            if (this.simulatorTarget.toLowerCase() !== IOSPlatform.simulatorString) {
                runArguments.push("--simulator", this.simulatorTarget);
            }

            runArguments.push("--project-path", this.runOptions.iosRelativeProjectPath);

            const runIosSpawn = new CommandExecutor(this.projectPath).spawnReactCommand("run-ios", runArguments);
            return new OutputVerifier(
                () =>
                    this.generateSuccessPatterns(),
                () =>
                    Q(IOSPlatform.RUN_IOS_FAILURE_PATTERNS)).process(runIosSpawn);
        }

        return new Compiler(this.iosProjectPath).compile().then(() => {
            return new DeviceDeployer(this.iosProjectPath).deploy();
        }).then(() => {
            return new DeviceRunner(this.iosProjectPath).run();
        });
    }

    public enableJSDebuggingMode(): Q.Promise<void> {
        // Configure the app for debugging
        if (this.simulatorTarget.toLowerCase() === IOSPlatform.deviceString) {
            // Note that currently we cannot automatically switch the device into debug mode.
            Log.logMessage("Application is running on a device, please shake device and select 'Debug in Chrome' to enable debugging.");
            return Q.resolve<void>(void 0);
        }

        const iosDebugModeManager = new IOSDebugModeManager(this.iosProjectPath);

        // Wait until the configuration file exists, and check to see if debugging is enabled
        return Q.all([
            iosDebugModeManager.getSimulatorJSDebuggingModeSetting(),
            this.getBundleId(),
        ]).spread((debugModeSetting: string, bundleId: string) => {
            if (debugModeSetting !== IOSDebugModeManager.WEBSOCKET_EXECUTOR_NAME) {
                // Debugging must still be enabled
                // We enable debugging by writing to a plist file that backs a NSUserDefaults object,
                // but that file is written to by the app on occasion. To avoid races, we shut the app
                // down before writing to the file.
                const childProcess = new ChildProcess();

                return childProcess.execToString("xcrun simctl spawn booted launchctl list").then((output: string) => {
                    // Try to find an entry that looks like UIKitApplication:com.example.myApp[0x4f37]
                    const regex = new RegExp(`(\\S+${bundleId}\\S+)`);
                    const match = regex.exec(output);

                    // If we don't find a match, the app must not be running and so we do not need to close it
                    if (match) {
                        return childProcess.exec(`xcrun simctl spawn booted launchctl stop ${match[1]}`);
                    }
                }).then(() => {
                    // Write to the settings file while the app is not running to avoid races
                    return iosDebugModeManager.setSimulatorJSDebuggingModeSetting(/*enable=*/ true);
                }).then(() => {
                    // Relaunch the app
                    return this.runApp();
                });
            }
        });
    }

    public prewarmBundleCache(): Q.Promise<void> {
        return this.remoteExtension.prewarmBundleCache(this.platformName);
    }

    private generateSuccessPatterns(): Q.Promise<string[]> {
        return this.getBundleId().then(bundleId =>
            IOSPlatform.RUN_IOS_SUCCESS_PATTERNS.concat([`Launching ${bundleId}\n${bundleId}: `]));
    }

    private getBundleId(): Q.Promise<string> {
        return this.plistBuddy.getBundleId(this.iosProjectPath);
    }
}
