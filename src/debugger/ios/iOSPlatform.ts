// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.

import * as Q from "q";

import {Log} from "../../common/log/log";
import {ChildProcess} from "../../common/node/childProcess";
import {CommandExecutor} from "../../common/commandExecutor";
import {IAppPlatform} from "../platformResolver";
import {Compiler} from "./compiler";
import {DeviceDeployer} from "./deviceDeployer";
import {DeviceRunner} from "./deviceRunner";
import {IRunOptions} from "../../common/launchArgs";
import {PlistBuddy} from "../../common/ios/plistBuddy";
import {IOSDebugModeManager} from "../../common/ios/iOSDebugModeManager";
import {OutputVerifier, PatternToFailure} from "../../common/outputVerifier";

export class IOSPlatform implements IAppPlatform {
    private static deviceString = "device";
    private static simulatorString = "simulator";

    private plistBuddy = new PlistBuddy();

    private projectPath: string;
    private simulatorTarget: string;
    private isSimulator: boolean;

    // We should add the common iOS build/run erros we find to this list
    private static RUN_IOS_FAILURE_PATTERNS: PatternToFailure = {
        "No devices are booted": "Unable to launch iOS simulator. Try specifying a different target.",
        "FBSOpenApplicationErrorDomain": "Unable to launch iOS simulator. Try specifying a different target.",
    };

    private static RUN_IOS_SUCCESS_PATTERNS = ["BUILD SUCCEEDED"];

    public runApp(launchArgs: IRunOptions): Q.Promise<void> {
        // Compile, deploy, and launch the app on either a simulator or a device
        this.consumeArguments(launchArgs);

        if (this.isSimulator) {
            // React native supports running on the iOS simulator from the command line
            let runArguments: string[] = [];
            if (this.simulatorTarget.toLowerCase() !== IOSPlatform.simulatorString) {
                runArguments.push("--simulator");
                runArguments.push(this.simulatorTarget);
            }

            const runIosSpawn = new CommandExecutor(this.projectPath).spawnReactCommand("run-ios", runArguments);
            return new OutputVerifier(
                () =>
                    this.generateSuccessPatterns(launchArgs),
                () =>
                    Q(IOSPlatform.RUN_IOS_FAILURE_PATTERNS)).process(runIosSpawn);
        }

        return new Compiler(this.projectPath).compile().then(() => {
            return new DeviceDeployer(this.projectPath).deploy();
        }).then(() => {
            return new DeviceRunner(this.projectPath).run();
        });
    }

    public enableJSDebuggingMode(launchArgs: IRunOptions): Q.Promise<void> {
        // Configure the app for debugging
        this.consumeArguments(launchArgs);

        if (this.simulatorTarget.toLowerCase() === IOSPlatform.deviceString) {
            // Note that currently we cannot automatically switch the device into debug mode.
            Log.logMessage("Application is running on a device, please shake device and select 'Debug in Chrome' to enable debugging.");
            return Q.resolve<void>(void 0);
        }

        const iosDebugModeManager = new IOSDebugModeManager(this.projectPath);

        // Wait until the configuration file exists, and check to see if debugging is enabled
        return Q.all([
            iosDebugModeManager.getSimulatorJSDebuggingModeSetting(),
            this.plistBuddy.getBundleId(launchArgs.projectRoot),
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
                    return this.runApp(launchArgs);
                });
            }
        });
    }

    private consumeArguments(launchArgs: IRunOptions): void {
        this.projectPath = launchArgs.projectRoot;
        this.simulatorTarget = launchArgs.target || IOSPlatform.simulatorString;
        this.isSimulator = this.simulatorTarget.toLowerCase() !== IOSPlatform.deviceString;
    }

    private generateSuccessPatterns(launchArgs: IRunOptions): Q.Promise<string[]> {
        return this.plistBuddy.getBundleId(launchArgs.projectRoot).then(bundleId =>
            IOSPlatform.RUN_IOS_SUCCESS_PATTERNS.concat([`Launching ${bundleId}\n${bundleId}: `]));
    }
}
