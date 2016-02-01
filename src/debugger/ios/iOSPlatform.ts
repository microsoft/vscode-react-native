// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.

import * as Q from "q";

import {CommandExecutor} from "../../utils/commands/commandExecutor";
import {IMobilePlatform} from "../platformResolver";
import {Compiler} from "./compiler";
import {DeviceDeployer} from "./deviceDeployer";
import {DeviceRunner} from "./deviceRunner";
import {IRunOptions} from "../launchArgs";
import {SimulatorPlist} from "./simulatorPlist";
import {IOSUtils} from "./utils";

export class IOSPlatform implements IMobilePlatform {
    public runApp(launchArgs: IRunOptions): Q.Promise<void> {
        // Compile, deploy, and launch the app on either a simulator or a device
        const projectPath: string = launchArgs.projectRoot; // TODO: get these settings passed in appropriately.
        const simulatorTarget: string = launchArgs.target || "simulator";
        const isSimulator = simulatorTarget.toLowerCase() !== "device";

        if (isSimulator) {
            // React native supports running on the iOS simulator from the command line
            let runArguments = ["run-ios"];
            if (simulatorTarget.toLowerCase() !== "simulator") {
                runArguments.push("--simulator");
                runArguments.push(simulatorTarget);
            }

            return new CommandExecutor(projectPath).spawn("react-native", runArguments);
        }

        // TODO: This is currently a stub, device debugging is not yet implemented
        return new Compiler(projectPath, isSimulator).compile().then(() => {
            return new DeviceDeployer(projectPath).deploy();
        }).then(() => {
            return new DeviceRunner(projectPath).run();
        });
    }

    public enableJSDebuggingMode(launchArgs: IRunOptions): Q.Promise<void> {
        // Configure the app for debugging

        const simulatorTarget: string = launchArgs.target || "simulator";
        if (simulatorTarget.toLowerCase() === "device") {
            // Note that currently we cannot automatically switch the device into debug mode.
            console.log("Application is running on a device, please shake device and select 'Debug in Javascript' to enable debugging.");
            return Q.resolve<void>(void 0);
        }

        const iosUtils = new IOSUtils();
        // Find the plistFile with the configuration setting
        return new SimulatorPlist(launchArgs.projectRoot).findPlistFile().then((plistFile: string) => {
            // Set the executorClass to be RCTWebSocketExecutor so on the next startup it will default into debug mode
            // This is approximately equivalent to clicking the "Debug in Chrome" button
            return iosUtils.setPlistProperty(plistFile, ":RCTDevMenu:executorClass", "RCTWebSocketExecutor");
        }).then(() => {
            return iosUtils.getBundleId(launchArgs.projectRoot);
        }).then((bundleId: string) => {
            // Relaunch the app so the new setting can take effect
            return new CommandExecutor(".").execute(`xcrun simctl launch booted ${bundleId}`);
        });
    }
}