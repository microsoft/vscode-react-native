// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.

import * as Q from "q";

import {Log} from "../../utils/commands/log";
import {CommandExecutor} from "../../utils/commands/commandExecutor";
import {IAppPlatform} from "../platformResolver";
import {Compiler} from "./compiler";
import {DeviceDeployer} from "./deviceDeployer";
import {DeviceRunner} from "./deviceRunner";
import {IRunOptions} from "../launchArgs";
import {SimulatorPlist} from "./simulatorPlist";
import {PlistBuddy} from "./plistBuddy";

export class IOSPlatform implements IAppPlatform {
    private static deviceString = "device";
    private static simulatorString = "simulator";

    private projectPath: string;
    private simulatorTarget: string;
    private isSimulator: boolean;

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

            return new CommandExecutor(this.projectPath).spawnAndWaitReactCommand("run-ios", runArguments);
        }

        // TODO: This is currently a stub, device debugging is not yet implemented
        return new Compiler(this.projectPath, this.isSimulator).compile().then(() => {
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
            Log.logMessage("Application is running on a device, please shake device and select 'Debug in Javascript' to enable debugging.");
            return Q.resolve<void>(void 0);
        }

        const plistBuddy = new PlistBuddy();
        // Find the plistFile with the configuration setting
        return new SimulatorPlist(launchArgs.projectRoot).findPlistFile().then((plistFile: string) => {
            // Set the executorClass to be RCTWebSocketExecutor so on the next startup it will default into debug mode
            // This is approximately equivalent to clicking the "Debug in Chrome" button
            return plistBuddy.setPlistProperty(plistFile, ":RCTDevMenu:executorClass", "RCTWebSocketExecutor");
        }).then(() => {
            return plistBuddy.getBundleId(launchArgs.projectRoot);
        }).then((bundleId: string) => {
            // Relaunch the app so the new setting can take effect
            return new CommandExecutor().execute(`xcrun simctl launch booted ${bundleId}`);
        });
    }

    private consumeArguments(launchArgs: IRunOptions): void {
        this.projectPath = launchArgs.projectRoot;
        this.simulatorTarget = launchArgs.target || IOSPlatform.simulatorString;
        this.isSimulator = this.simulatorTarget.toLowerCase() !== IOSPlatform.deviceString;
    }
}