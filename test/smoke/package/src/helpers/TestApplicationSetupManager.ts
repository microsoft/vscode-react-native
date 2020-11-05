// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.

import * as path from "path";
import * as cp from "child_process";
import * as fs from "fs";
import * as semver from "semver";
import * as rimraf from "rimraf";
import * as utilities from "./utilities";
import { SmokeTestsConstants } from "./smokeTestsConstants";

export class TestApplicationSetupManager {

    private rnWorkspaceDirectory: string;
    private hermesWorkspaceDirectory: string;
    private pureRnWorkspaceDirectory: string;
    private expoWorkspaceDirectory: string;

    private hermesSampleDirectory: string;
    private rnSampleDirectory: string;
    private pureRnSampleDirectory: string;
    private expoSampleDirectory: string;

    private launchJsonPath: string;

    constructor(resourcesDirectory: string, cacheDirectory: string) {
        const testAppsDirectory = path.join(cacheDirectory, "TestApps");

        this.rnWorkspaceDirectory = path.join(testAppsDirectory, SmokeTestsConstants.RNAppName);
        this.hermesWorkspaceDirectory = path.join(testAppsDirectory, SmokeTestsConstants.HermesAppName);
        this.pureRnWorkspaceDirectory = path.join(testAppsDirectory, SmokeTestsConstants.pureRNExpoAppName);
        this.expoWorkspaceDirectory = path.join(testAppsDirectory, SmokeTestsConstants.ExpoAppName);

        this.rnSampleDirectory = path.join(resourcesDirectory, SmokeTestsConstants.sampleRNAppName);
        this.hermesSampleDirectory = path.join(resourcesDirectory, SmokeTestsConstants.sampleHermesAppName);
        this.pureRnSampleDirectory = path.join(resourcesDirectory, SmokeTestsConstants.samplePureRNExpoAppName);
        this.expoSampleDirectory = path.join(resourcesDirectory, SmokeTestsConstants.sampleExpoAppName);

        this.launchJsonPath = path.join(resourcesDirectory, "launch.json");
    }

    public async prepareTestApplications(): Promise<void> {
        console.log("*** Preparing smoke tests applications...");
        const rnVersion = process.env.RN_VERSION;
        const pureRnVersion = process.env.PURE_RN_VERSION || await TestApplicationSetupManager.getLatestSupportedRNVersionForExpo(process.env.EXPO_SDK_MAJOR_VERSION);
        const expoSdkVersion = process.env.EXPO_SDK_MAJOR_VERSION;
        const pureExpoSdkVersion = process.env.PURE_EXPO_VERSION;
        this.prepareReactNativeApplication(this.rnWorkspaceDirectory, rnVersion);
        this.prepareExpoApplication(this.expoWorkspaceDirectory, expoSdkVersion);
        this.preparePureExpoApplication(this.pureRnWorkspaceDirectory, pureRnVersion, pureExpoSdkVersion);
        this.prepareHermesApplication(this.hermesWorkspaceDirectory, rnVersion);
    }

    private static async getLatestSupportedRNVersionForExpo(expoSdkMajorVersion?: string): Promise<any> {
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

    private prepareReactNativeProjectForHermesTesting(workspacePath?: string) {
        const workspaceDirectory = workspacePath ? workspacePath : this.hermesWorkspaceDirectory;
        const {workspaceEntryPointPath} = this.getKeyPathsForApplication(workspaceDirectory);
        const commandClean = path.join(workspaceDirectory, "android", "gradlew") + " clean";
        const {customEntryPointPath, testButtonPath} = this.getKeyPathsForSample(this.hermesSampleDirectory);

        console.log(`*** Executing  ${commandClean} ...`);
        cp.execSync(commandClean, { cwd: path.join(workspaceDirectory, "android"), stdio: "inherit" });

        console.log(`*** Copying  ${customEntryPointPath} into ${workspaceEntryPointPath}...`);
        fs.writeFileSync(workspaceEntryPointPath, fs.readFileSync(customEntryPointPath));

        this.copyGradleFilesToHermesApp(workspaceDirectory, customEntryPointPath);

        console.log(`*** Copying ${testButtonPath} into ${workspaceDirectory}`);
        fs.copyFileSync(testButtonPath, path.join(workspaceDirectory, "AppTestButton.js"));
    }

    private getKeyPathsForApplication(workspacePath: string): { appName: string, parentPathForWorkspace: string, vsCodeConfigPath: string, workspaceEntryPointPath: string } {
        const appName = path.dirname(workspacePath);
        const parentPathForWorkspace = path.join(workspacePath, "..");
        const vsCodeConfigPath = path.join(workspacePath, ".vscode");
        let workspaceEntryPointPath = path.join(workspacePath, SmokeTestsConstants.ApptsxFileName);
        if (!fs.existsSync(workspaceEntryPointPath)) {
            workspaceEntryPointPath = path.join(workspacePath, SmokeTestsConstants.AppjsFileName);
        }
        return {appName, parentPathForWorkspace, vsCodeConfigPath, workspaceEntryPointPath};
    }

    private getKeyPathsForSample(workspacePath: string): {testButtonPath: string, customEntryPointPath: string} {
        const testButtonPath = path.join(this.rnSampleDirectory, "AppTestButton.js");
        let customEntryPointPath = path.join(this.rnSampleDirectory, SmokeTestsConstants.ApptsxFileName);
        if (!fs.existsSync(customEntryPointPath)) {
            customEntryPointPath = path.join(workspacePath, SmokeTestsConstants.AppjsFileName);
        }

        return {testButtonPath, customEntryPointPath};
    }

    private prepareReactNativeApplication(workspacePath?: string, version?: string) {
        const workspaceDirectory = workspacePath ? workspacePath : this.rnWorkspaceDirectory;
        const {appName, parentPathForWorkspace, vsCodeConfigPath, workspaceEntryPointPath} = this.getKeyPathsForApplication(workspaceDirectory);
        const {customEntryPointPath} = this.getKeyPathsForSample(this.rnSampleDirectory);

        let command = `react-native init ${appName}`;
        if (version) {
            command += ` --version ${version}`;
        }
        console.log(`*** Creating RN app via '${command}' in ${workspaceDirectory}...`);
        cp.execSync(command, { cwd: parentPathForWorkspace, stdio: "inherit" });

        console.log(`*** Copying  ${customEntryPointPath} into ${workspaceEntryPointPath}...`);
        fs.writeFileSync(workspaceEntryPointPath, fs.readFileSync(customEntryPointPath));

        if (!fs.existsSync(vsCodeConfigPath)) {
            console.log(`*** Creating  ${vsCodeConfigPath}...`);
            fs.mkdirSync(vsCodeConfigPath);
        }

        console.log(`*** Copying  ${this.launchJsonPath} into ${vsCodeConfigPath}...`);
        fs.writeFileSync(path.join(vsCodeConfigPath, "launch.json"), fs.readFileSync(this.launchJsonPath));

        this.patchMetroConfig(workspaceDirectory);
    }

    private prepareExpoApplication(workspacePath?: string, expoSdkMajorVersion?: string) {
        const workspaceDirectory = workspacePath ? workspacePath : this.expoWorkspaceDirectory;
        const {appName, parentPathForWorkspace, vsCodeConfigPath, workspaceEntryPointPath} = this.getKeyPathsForApplication(workspaceDirectory);
        const {customEntryPointPath} = this.getKeyPathsForSample(this.expoSampleDirectory);
        const useSpecificSdk = expoSdkMajorVersion ? `@sdk-${expoSdkMajorVersion}` : "";
        const command = `echo -ne '\\n' | expo init -t tabs${useSpecificSdk} --name ${appName} ${appName}`;

        console.log(`*** Creating Expo app via '${command}' in ${workspaceDirectory}...`);
        cp.execSync(command, { cwd: parentPathForWorkspace, stdio: "inherit" });

        console.log(`*** Copying  ${customEntryPointPath} into ${workspaceEntryPointPath}...`);
        fs.writeFileSync(workspaceEntryPointPath, fs.readFileSync(customEntryPointPath));

        if (!fs.existsSync(vsCodeConfigPath)) {
            console.log(`*** Creating  ${vsCodeConfigPath}...`);
            fs.mkdirSync(vsCodeConfigPath);
        }

        console.log(`*** Copying  ${this.launchJsonPath} into ${vsCodeConfigPath}...`);
        fs.writeFileSync(path.join(vsCodeConfigPath, "launch.json"), fs.readFileSync(this.launchJsonPath));

        this.patchMetroConfig(workspaceDirectory);
        this.patchExpoSettingsFile();
    }

    private preparePureExpoApplication(workspacePath?: string, rnVersion?: string, expoVersion?: string) {
        const workspaceDirectory = workspacePath ? workspacePath : this.pureRnWorkspaceDirectory;
        this.prepareReactNativeApplication(workspaceDirectory, rnVersion);
        this.addExpoDependencyToRNProject(workspaceDirectory, expoVersion);
    }

    private prepareHermesApplication(workspacePath?: string, rnVersion?: string) {
        const workspaceDirectory = workspacePath ? workspacePath : this.pureRnWorkspaceDirectory;
        this.prepareReactNativeApplication(workspaceDirectory, rnVersion);
        this.prepareReactNativeProjectForHermesTesting(workspaceDirectory);
    }

    private addExpoDependencyToRNProject(workspacePath?: string, version?: string) {
        const workspaceDirectory = workspacePath ? workspacePath : this.pureRnWorkspaceDirectory;
        const {customEntryPointPath} = this.getKeyPathsForSample(this.pureRnSampleDirectory);
        const {workspaceEntryPointPath} = this.getKeyPathsForApplication(workspaceDirectory);

        let npmCmd = "npm";
        if (process.platform === "win32") {
            npmCmd = "npm.cmd";
        }

        let expoPackage: string = version ? `expo@${version}` : "expo";
        const command = `${npmCmd} install ${expoPackage} --save-dev`;

        console.log(`*** Adding expo dependency to ${workspaceDirectory} via '${command}' command...`);
        cp.execSync(command, { cwd: workspaceDirectory, stdio: "inherit" });

        console.log(`*** Copying  ${customEntryPointPath} into ${workspaceEntryPointPath}...`);
        fs.writeFileSync(workspaceEntryPointPath, fs.readFileSync(customEntryPointPath));
    }

    private copyGradleFilesToHermesApp(workspacePath: string, customEntryPointPath: string) {
        const appGradleBuildFilePath = path.join(workspacePath, "android", "app", "build.gradle");
        const resGradleBuildFilePath = path.join(customEntryPointPath, "..", "build.gradle");

        console.log(`*** Copying  ${resGradleBuildFilePath} into ${appGradleBuildFilePath}...`);
        fs.writeFileSync(appGradleBuildFilePath, fs.readFileSync(resGradleBuildFilePath));
    }

    private patchMetroConfig(appPath: string) {
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

    public cleanUp(): void {

        if (fs.existsSync(this.rnWorkspaceDirectory)) {
            console.log(`*** Deleting test application: ${this.rnWorkspaceDirectory}`);
            rimraf.sync(this.rnWorkspaceDirectory);
        }

        if (fs.existsSync(this.hermesWorkspaceDirectory)) {
            console.log(`*** Deleting test application: ${this.hermesWorkspaceDirectory}`);
            rimraf.sync(this.hermesWorkspaceDirectory);
        }

        if (fs.existsSync(this.pureRnWorkspaceDirectory)) {
            console.log(`*** Deleting test application: ${this.pureRnWorkspaceDirectory}`);
            rimraf.sync(this.pureRnWorkspaceDirectory);
        }

        if (fs.existsSync(this.expoWorkspaceDirectory)) {
            console.log(`*** Deleting test application: ${this.expoWorkspaceDirectory}`);
            rimraf.sync(this.expoWorkspaceDirectory);
        }

        if (fs.existsSync(SmokeTestsConstants.iOSExpoAppsCacheDir)) {
            console.log(`*** Deleting iOS expo app cache directory: ${SmokeTestsConstants.iOSExpoAppsCacheDir}`);
            rimraf.sync(SmokeTestsConstants.iOSExpoAppsCacheDir);
        }
    }

    // Fix for https://github.com/expo/expo-cli/issues/951
    // TODO: Delete when bug will be fixed
    private patchExpoSettingsFile() {
        const settingsJsonPath = path.join(this.expoWorkspaceDirectory, ".expo", "settings.json");
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

}