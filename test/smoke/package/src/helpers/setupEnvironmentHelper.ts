// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.

import * as path from "path";
import * as utilities from "./utilities";
import * as fs from "fs";
import * as rimraf from "rimraf";
import * as cp from "child_process";
import * as semver from "semver";
import * as os from "os";
import { IosSimulatorHelper } from "./iosSimulatorHelper";
import { sleep } from "./utilities";
import { AndroidEmulatorHelper } from "./androidEmulatorHelper";
import * as XDL from "@expo/xdl";


export class SetupEnvironmentHelper {

    public static expoPackageName = "host.exp.exponent";
    public static expoBundleId = "host.exp.Exponent";
    public static iOSExpoAppsCacheDir = `${os.homedir()}/.expo/ios-simulator-app-cache`;

    public static prepareReactNativeApplication(workspaceFilePath: string, resourcesPath: string, workspacePath: string, appName: string, customEntryPointFolder: string, version?: string) {
        let command = `react-native init ${appName}`;
        if (version) {
            command += ` --version ${version}`;
        }
        console.log(`*** Creating RN app via '${command}' in ${workspacePath}...`);
        cp.execSync(command, { cwd: resourcesPath, stdio: "inherit" });

        const customEntryPointFile = path.join(resourcesPath, customEntryPointFolder, "App.js");
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

        SetupEnvironmentHelper.patchMetroConfig(workspacePath);
    }

    public static prepareHermesReactNativeApplication(workspaceFilePath: string, resourcesPath: string, workspacePath: string, appName: string, customEntryPointFolder: string, version?: string) {
        const commandClean = path.join(workspacePath, "android", "gradlew") + " clean";

        console.log(`*** Executing  ${commandClean} ...`);
        cp.execSync(commandClean, { cwd: path.join(workspacePath, "android"), stdio: "inherit" });

        const customEntryPointFile = path.join(resourcesPath, customEntryPointFolder, "App.js");
        const testButtonPath = path.join(resourcesPath, customEntryPointFolder, "AppTestButton.js");

        console.log(`*** Copying  ${customEntryPointFile} into ${workspaceFilePath}...`);
        fs.writeFileSync(workspaceFilePath, fs.readFileSync(customEntryPointFile));

        SetupEnvironmentHelper.copyGradleFilesToHermesApp(workspacePath, resourcesPath, customEntryPointFolder);

        console.log(`*** Copying ${testButtonPath} into ${workspacePath}`);
        fs.copyFileSync(testButtonPath, path.join(workspacePath, "AppTestButton.js"));
    }

    public static prepareExpoApplication(workspaceFilePath: string, resourcesPath: string, workspacePath: string, appName: string, expoSdkMajorVersion?: string) {
        const useSpecificSdk = expoSdkMajorVersion ? `@sdk-${expoSdkMajorVersion}` : "";
        const command = `echo -ne '\\n' | expo init -t tabs${useSpecificSdk} --name ${appName} ${appName}`;
        console.log(`*** Creating Expo app via '${command}' in ${workspacePath}...`);
        cp.execSync(command, { cwd: resourcesPath, stdio: "inherit" });

        const customEntryPointFile = path.join(resourcesPath, "ExpoSample", "App.tsx");
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

        SetupEnvironmentHelper.patchMetroConfig(workspacePath);
    }

    public static addExpoDependencyToRNProject(workspacePath: string, version?: string) {
        let npmCmd = "npm";
        if (process.platform === "win32") {
            npmCmd = "npm.cmd";
        }

        let expoPackage: string = version ? `expo@${version}` : "expo";
        const command = `${npmCmd} install ${expoPackage} --save-dev`;

        console.log(`*** Adding expo dependency to ${workspacePath} via '${command}' command...`);
        cp.execSync(command, { cwd: workspacePath, stdio: "inherit" });
    }

    public static cleanUp(testVSCodeDirectory: string, userDataDir: string, testLogsDirectory: string, workspacePaths: string[], iOSExpoAppsCacheDirectory: string) {
        console.log("\n*** Clean up...");
        if (fs.existsSync(testVSCodeDirectory)) {
            console.log(`*** Deleting test VS Code directory: ${testVSCodeDirectory}`);
            rimraf.sync(testVSCodeDirectory);
        }
        if (fs.existsSync(userDataDir)) {
            console.log(`*** Deleting VS Code temporary user data dir: ${userDataDir}`);
            rimraf.sync(userDataDir);
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
        if (fs.existsSync(iOSExpoAppsCacheDirectory)) {
            console.log(`*** Deleting iOS expo app cache directory: ${iOSExpoAppsCacheDirectory}`);
            rimraf.sync(iOSExpoAppsCacheDirectory);
        }
    }

    public static async getLatestSupportedRNVersionForExpo(expoSdkMajorVersion?: string): Promise<any> {
        const printSpecifiedMajorVersion = expoSdkMajorVersion ? `sdk-${expoSdkMajorVersion}` : "";
        const printIsLatest = printSpecifiedMajorVersion ? "" : "latest ";
        console.log(`*** Getting latest React Native version supported by ${printIsLatest}Expo ${printSpecifiedMajorVersion}...`);
        return new Promise((resolve, reject) => {
            utilities.getContents("https://exp.host/--/api/v2/versions", null, null, function (error, versionsContent) {
                if (error) {
                    reject(error);
                }
                try {
                   const content = JSON.parse(versionsContent);
                   if (content.sdkVersions) {
                       let usesSdkVersion: string | undefined;
                       if (expoSdkMajorVersion) {
                            usesSdkVersion = Object.keys(content.sdkVersions).find((version) => semver.major(version) === parseInt(expoSdkMajorVersion));
                            if (!usesSdkVersion) {
                                console.log(`*** Сould not find the version of Expo sdk matching the specified version - ${printSpecifiedMajorVersion}`);
                            }
                       }
                       if (!usesSdkVersion) {
                            usesSdkVersion = Object.keys(content.sdkVersions).sort((ver1, ver2) => {
                                if (semver.lt(ver1, ver2)) {
                                    return 1;
                                } else if (semver.gt(ver1, ver2)) {
                                    return -1;
                                }
                                return 0;
                            })[0];
                       }
                       if (content.sdkVersions[usesSdkVersion]) {
                        if (content.sdkVersions[usesSdkVersion].facebookReactNativeVersion) {
                            console.log(`*** Latest React Native version supported by Expo ${printSpecifiedMajorVersion}: ${content.sdkVersions[usesSdkVersion].facebookReactNativeVersion}`);
                            resolve(content.sdkVersions[usesSdkVersion].facebookReactNativeVersion as string);
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

    // Installs Expo app on Android device using XDL function
    public static async installExpoAppOnAndroid() {
        console.log(`*** Installing Expo app on Android emulator using Expo XDL function`);
        await XDL.Android.installExpoAsync({
            device: {
                name: AndroidEmulatorHelper.getOnlineDevices()[0].id,
                type: "emulator",
                isBooted: true,
                isAuthorized: true,
            }
        });
        AndroidEmulatorHelper.enableDrawPermitForApp(this.expoPackageName);
    }

    // Installs Expo app on iOS device using XDL function
    public static async installExpoAppOnIos() {
        console.log(`*** Installing Expo app on iOS simulator using Expo XDL function`);
        await XDL.Simulator.installExpoOnSimulatorAsync({
            simulator: {
                name: IosSimulatorHelper.getDevice() || "",
                udid: IosSimulatorHelper.getDeviceUdid() || ""
            }
        });
    }

    // Fix for https://github.com/expo/expo-cli/issues/951
    // TODO: Delete when bug will be fixed
    public static patchExpoSettingsFile(expoAppPath: string) {
        const settingsJsonPath = path.join(expoAppPath, ".expo", "settings.json");
        if (fs.existsSync(settingsJsonPath)) {
            console.log(`*** Patching ${settingsJsonPath}...`);
            let content = JSON.parse(fs.readFileSync(settingsJsonPath).toString());
            if (content.https === false) {
                console.log(`*** Deleting https: ${content.https} line...`);
                delete content.https;
                content = JSON.stringify(content, null, 2);
                fs.writeFileSync(settingsJsonPath, content);
            }
        }
    }

    public static setIosTargetToLaunchJson(workspacePath: string, configName: string, target?: string) {
        let launchJsonPath = path.join(workspacePath, ".vscode", "launch.json");
        if (target) {
            console.log(`*** Implicitly adding target to "${configName}" config for ${launchJsonPath}`);
        }
        else {
            console.log(`*** Implicitly remove target from "${configName}" config`);
        }
        let content = JSON.parse(fs.readFileSync(launchJsonPath).toString());
        let found = false;
        for (let i = 0; i < content.configurations.length; i++) {
            if (content.configurations[i].name === configName) {
                found = true;
                if (!target) {
                    delete content.configurations[i].target;
                }
                else {
                    content.configurations[i].target = target;
                }
            }
        }
        if (!found) {
            throw new Error("Couldn't find \"Debug iOS\" configuration");
        }
        fs.writeFileSync(launchJsonPath, JSON.stringify(content, undefined, 4)); // Adds indentations
    }

    public static async runIosSimulator() {
        const device = <string>IosSimulatorHelper.getDevice();
        await this.terminateIosSimulator();
        // Wipe data on simulator
        await IosSimulatorHelper.eraseSimulator(device);
        console.log(`*** Executing iOS simulator with 'xcrun simctl boot "${device}"' command...`);
        await IosSimulatorHelper.bootSimulator(device);
        await sleep(15 * 1000);
    }

    public static async terminateIosSimulator() {
        const device = <string>IosSimulatorHelper.getDevice();
        await IosSimulatorHelper.shutdownSimulator(device);
    }

    public static installExpoXdlPackageToExtensionDir(extensionDir: any, packageVersion: string) {
        let npmCmd = "npm";
        if (process.platform === "win32") {
            npmCmd = "npm.cmd";
        }
        const command = `${npmCmd} install @expo/xdl@${packageVersion} --no-save`;

        console.log(`*** Adding @expo/xdl dependency to ${extensionDir} via '${command}' command...`);
        cp.execSync(command, { cwd: extensionDir, stdio: "inherit" });
    }

    public static async patchMetroConfig(appPath: string) {
        const metroConfigPath = path.join(appPath, "metro.config.js");
        console.log(`*** Patching  ${metroConfigPath}`);
        const patchContent = `
// Sometimes on Windows Metro fails to resolve files located at .vscode\.react directory and throws EPERM errors
// To avoid it this directory is added to black list for resolving by Metro
if (process.platform === "win32") {
    module.exports.resolver = {
        blacklistRE: /.*\.vscode\\\.react.*/
    };
}

// Redirect Metro cache
module.exports.cacheStores = [
    new (require('metro-cache')).FileStore({
        root: require('path').join(".cache", 'metro-cache'),
    }),
];

// Redirect Haste Map cache
module.exports.hasteMapCacheDirectory = ".cache";

// Due to the fact that Metro bundler on MacOS has problems with scanning files and folders starting with a dot (hidden folders), for example './vscode',
// the first time when the packager starts, it cannot find the './vscode/exponentIndex.js' file. So we add this folder to scanning manually.
module.exports.watchFolders = ['.vscode'];`;
        fs.appendFileSync(metroConfigPath, patchContent);
        const contentAfterPatching = fs.readFileSync(metroConfigPath);
        console.log(`*** Content of a metro.config.js after patching: ${contentAfterPatching}`);
    }

    private static copyGradleFilesToHermesApp(workspacePath: string, resourcesPath: string, customEntryPointFolder: string) {
        const appGradleBuildFilePath = path.join(workspacePath, "android", "app", "build.gradle");
        const resGradleBuildFilePath = path.join(resourcesPath, customEntryPointFolder, "build.gradle");

        console.log(`*** Copying  ${resGradleBuildFilePath} into ${appGradleBuildFilePath}...`);
        fs.writeFileSync(appGradleBuildFilePath, fs.readFileSync(resGradleBuildFilePath));
    }
}
