// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.

import * as path from "path";
import * as utilities from "./utilities";
import * as fs from "fs";
import * as rimraf from "rimraf";
import * as cp from "child_process";
import * as semver from "semver";
import { IosSimulatorHelper } from "./iosSimulatorHelper";
import { sleep } from "./utilities";

export class SetupEnvironmentHelper {
    public static  prepareReactNativeApplication(workspaceFilePath: string, resourcesPath: string, workspacePath: string, appName: string, version?: string) {
        let command = `react-native init ${appName}`;
        if (version) {
            command += ` --version ${version}`;
        }
        console.log(`*** Creating RN app via '${command}' in ${workspacePath}...`);
        cp.execSync(command, { cwd: resourcesPath, stdio: "inherit" });

        let customEntryPointFile = path.join(resourcesPath, "ReactNativeSample", "App.js");
        let launchConfigFile = path.join(resourcesPath, "launch.json");
        let vsCodeConfigPath = path.join(workspacePath, ".vscode");

        console.log(`*** Copying  ${customEntryPointFile} into ${workspaceFilePath}...`);
        fs.writeFileSync(workspaceFilePath, fs.readFileSync(customEntryPointFile));

        if (!fs.existsSync(vsCodeConfigPath)) {
            console.log(`*** Creating  ${vsCodeConfigPath}...`);
            fs.mkdirSync(vsCodeConfigPath);
        }

        console.log(`*** Copying  ${launchConfigFile} into ${vsCodeConfigPath}...`);
        fs.writeFileSync(path.join(vsCodeConfigPath, "launch.json"), fs.readFileSync(launchConfigFile));
    }

    public static prepareExpoApplication(workspaceFilePath: string, resourcesPath: string, workspacePath: string, appName: string) {
        const command = `echo -ne '\\n' | expo init -t tabs --name ${appName}  --workflow managed ${appName}`;
        console.log(`*** Creating Expo app via '${command}' in ${workspacePath}...`);
        cp.execSync(command, { cwd: resourcesPath, stdio: "inherit" });

        const customEntryPointFile = path.join(resourcesPath, "ExpoSample", "App.js");
        const launchConfigFile = path.join(resourcesPath, "launch.json");
        const vsCodeConfigPath = path.join(workspacePath, ".vscode");

        console.log(`*** Copying  ${customEntryPointFile} into ${workspaceFilePath}...`);
        fs.writeFileSync(workspaceFilePath, fs.readFileSync(customEntryPointFile));

        if (!fs.existsSync(vsCodeConfigPath)) {
            console.log(`*** Creating  ${vsCodeConfigPath}...`);
            fs.mkdirSync(vsCodeConfigPath);
        }

        console.log(`*** Copying  ${launchConfigFile} into ${vsCodeConfigPath}...`);
        fs.writeFileSync(path.join(vsCodeConfigPath, "launch.json"), fs.readFileSync(launchConfigFile));
    }

    public static addExpoDependencyToRNProject(workspacePath: string) {
        let npmCmd = "npm";
        if (process.platform === "win32") {
            npmCmd = "npm.cmd";
        }
        const command = `${npmCmd} install expo --no-save`;

        console.log(`*** Adding expo dependency to ${workspacePath} via '${command}' command...`);
        cp.execSync(command, { cwd: workspacePath, stdio: "inherit" });
    }

    public static cleanUp(testVSCodeDirectory: string, testLogsDirectory: string, workspacePaths: string[]) {
        console.log("\n*** Clean up...");
        if (fs.existsSync(testVSCodeDirectory)) {
            console.log(`*** Deleting test VS Code directory: ${testVSCodeDirectory}`);
            rimraf.sync(testVSCodeDirectory);
        }
        if (fs.existsSync(testLogsDirectory)) {
            console.log(`*** Deleting test logs directory: ${testLogsDirectory}`);
            rimraf.sync(testLogsDirectory);
        }
        workspacePaths.forEach(testAppFolder => {
            if (fs.existsSync(testAppFolder)) {
                console.log(`*** Deleting test application: ${testAppFolder}`);
                rimraf.sync(testAppFolder);
            }
        });
    }

    public static async getLatestSupportedRNVersionForExpo(): Promise<any> {
        console.log("*** Getting latest React Native version supported by Expo...");
        return new Promise((resolve, reject) => {
            utilities.getContents("https://exp.host/--/api/v2/versions", null, null, function (error, versionsContent) {
                if (error) {
                    reject(error);
                }
                try {
                   const content = JSON.parse(versionsContent);
                   if (content.sdkVersions) {
                       const maxSdkVersion = Object.keys(content.sdkVersions).sort((ver1, ver2) => {
                           if (semver.lt(ver1, ver2)) {
                               return 1;
                           } else if (semver.gt(ver1, ver2)) {
                               return -1;
                           }
                           return 0;
                       })[0];
                       if (content.sdkVersions[maxSdkVersion]) {
                           if (content.sdkVersions[maxSdkVersion].facebookReactNativeVersion) {
                               console.log(`*** Latest React Native version supported by Expo: ${content.sdkVersions[maxSdkVersion].facebookReactNativeVersion}`);
                               resolve(content.sdkVersions[maxSdkVersion].facebookReactNativeVersion as string);
                           }
                       }
                   }
                   reject("Received object is incorrect");
                } catch (error) {
                   reject(error);
                }
            });
        });
    }
}

export async function runiOSSimmulator() {
    if (!process.env.IOS_SIMULATOR) {
        throw new Error("Environment variable 'IOS_SIMULATOR' is not set. Exiting...");
    }
    await terminateiOSSimulator();
    // Wipe data on simulator
    await IosSimulatorHelper.eraseSimulator(process.env.IOS_SIMULATOR);
    console.log(`*** Executing iOS simulator with 'xcrun simctl boot "${process.env.IOS_SIMULATOR}"' command...`);
    await IosSimulatorHelper.runSimulator(process.env.IOS_SIMULATOR);
    await sleep(15 * 1000);
}

export async function terminateiOSSimulator() {
    if (!process.env.IOS_SIMULATOR) {
        throw new Error("Environment variable 'IOS_SIMULATOR' is not set. Exiting...");
    }
    await IosSimulatorHelper.terminateSimulator(process.env.IOS_SIMULATOR);
}



