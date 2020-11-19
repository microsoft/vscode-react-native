// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.

import * as path from "path";
import * as fs from "fs";
import * as semver from "semver";
import * as rimraf from "rimraf";
import * as utilities from "./utilities";
import { SmokeTestsConstants } from "./smokeTestsConstants";
import { SmokeTestLogger } from "./smokeTestLogger";
import { vscodeManager } from "../main";

export class TestApplicationSetupManager {

    private cacheDirectory: string;
    private testAppsDirectory: string;

    private rnWorkspaceDirectory: string;
    private hermesWorkspaceDirectory: string;
    private pureRnWorkspaceDirectory: string;
    private macOSRnWorkspaceDirectory: string;
    private windowsRnWorkspaceDirectory: string;
    private expoWorkspaceDirectory: string;

    private hermesSampleDirectory: string;
    private rnSampleDirectory: string;
    private pureRnSampleDirectory: string;
    private macOSRnSampleDirectory: string;
    private windowsRnSampleDirectory: string;
    private expoSampleDirectory: string;

    private launchJsonPath: string;

    constructor(resourcesDirectory: string, cacheDirectory: string) {
        this.testAppsDirectory = path.join(cacheDirectory, "TestApps");
        this.cacheDirectory = cacheDirectory;

        this.rnWorkspaceDirectory = path.join(this.testAppsDirectory, SmokeTestsConstants.RNAppName);
        this.hermesWorkspaceDirectory = path.join(this.testAppsDirectory, SmokeTestsConstants.HermesAppName);
        this.pureRnWorkspaceDirectory = path.join(this.testAppsDirectory, SmokeTestsConstants.pureRNExpoAppName);
        this.macOSRnWorkspaceDirectory = path.join(this.testAppsDirectory, SmokeTestsConstants.RNmacOSAppName);
        this.windowsRnWorkspaceDirectory = path.join(this.testAppsDirectory, SmokeTestsConstants.RNWAppName);
        this.expoWorkspaceDirectory = path.join(this.testAppsDirectory, SmokeTestsConstants.ExpoAppName);

        this.rnSampleDirectory = path.join(resourcesDirectory, SmokeTestsConstants.sampleRNAppName);
        this.hermesSampleDirectory = path.join(resourcesDirectory, SmokeTestsConstants.sampleHermesAppName);
        this.pureRnSampleDirectory = path.join(resourcesDirectory, SmokeTestsConstants.samplePureRNExpoAppName);
        this.macOSRnSampleDirectory = path.join(resourcesDirectory, SmokeTestsConstants.sampleRNmacOSAppName);
        this.windowsRnSampleDirectory = path.join(resourcesDirectory, SmokeTestsConstants.sampleRNWAppName);
        this.expoSampleDirectory = path.join(resourcesDirectory, SmokeTestsConstants.sampleExpoAppName);

        this.launchJsonPath = path.join(resourcesDirectory, "launch.json");
    }

    public getMacOSRnWorkspaceDirectory(): string {
        return this.macOSRnWorkspaceDirectory;
    }

    public getWindowsRnWorkspaceDirectory(): string {
        return this.windowsRnWorkspaceDirectory;
    }

    public getRnWorkspaceDirectory(): string {
        return this.rnWorkspaceDirectory;
    }

    public getHermesWorkspaceDirectory(): string {
        return this.hermesWorkspaceDirectory;
    }

    public getPureRnWorkspaceDirectory(): string {
        return this.pureRnWorkspaceDirectory;
    }

    public getExpoWorkspaceDirectory(): string {
        return this.expoWorkspaceDirectory;
    }

    public async prepareTestApplications(): Promise<void> {
        SmokeTestLogger.projectInstallLog("*** Preparing smoke tests applications...");

        if (!fs.existsSync(this.cacheDirectory)) {
            SmokeTestLogger.projectInstallLog(`*** Creating smoke tests cache directory: ${this.cacheDirectory}`);
            fs.mkdirSync(this.cacheDirectory);
        }
        if (!fs.existsSync(this.testAppsDirectory)) {
            SmokeTestLogger.projectInstallLog(`*** Creating test apps directory: ${this.testAppsDirectory}`);
            fs.mkdirSync(this.testAppsDirectory);
        }

        const rnVersion = process.env.RN_VERSION;
        const pureRnVersion = process.env.PURE_RN_VERSION || await TestApplicationSetupManager.getLatestSupportedRNVersionForExpo(process.env.EXPO_SDK_MAJOR_VERSION);
        const expoSdkVersion = process.env.EXPO_SDK_MAJOR_VERSION;
        const pureExpoSdkVersion = process.env.PURE_EXPO_VERSION;

        this.prepareReactNativeApplication(this.rnWorkspaceDirectory, this.rnSampleDirectory, rnVersion);
        this.prepareExpoApplication(this.expoWorkspaceDirectory, this.expoSampleDirectory, expoSdkVersion);
        this.preparePureExpoApplication(this.pureRnWorkspaceDirectory, this.pureRnSampleDirectory, pureRnVersion, pureExpoSdkVersion);
        this.prepareHermesApplication(this.hermesWorkspaceDirectory, this.hermesSampleDirectory, rnVersion);
        if (process.platform === "darwin") {
            this.prepareMacOSApplication(this.macOSRnWorkspaceDirectory, this.macOSRnSampleDirectory, rnVersion);
        }
        if (process.platform === "win32") {
            this.prepareRNWApplication(this.windowsRnWorkspaceDirectory, this.windowsRnSampleDirectory, rnVersion);
        }
    }

    private static async getLatestSupportedRNVersionForExpo(expoSdkMajorVersion?: string): Promise<any> {
        const printSpecifiedMajorVersion = expoSdkMajorVersion ? `sdk-${expoSdkMajorVersion}` : "";
        const printIsLatest = printSpecifiedMajorVersion ? "" : "latest ";
        SmokeTestLogger.info(`*** Getting latest React Native version supported by ${printIsLatest}Expo ${printSpecifiedMajorVersion}...`);
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
                                SmokeTestLogger.warn(`*** Сould not find the version of Expo sdk matching the specified version - ${printSpecifiedMajorVersion}`);
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
                                SmokeTestLogger.success(`*** Latest React Native version supported by Expo ${printSpecifiedMajorVersion}: ${content.sdkVersions[usesSdkVersion].facebookReactNativeVersion}`);
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

    private prepareReactNativeProjectForWindowsApplication(workspacePath: string): void {
        const command = `${utilities.npxCommand} react-native-windows-init --overwrite`;
        SmokeTestLogger.projectPatchingLog(`*** Install additional RNW packages using ${command}`);
        utilities.execSync(
            command,
            { cwd: workspacePath, stdio: "inherit" },
            vscodeManager.getSetupEnvironmentLogDir()
        );
    }

    private prepareReactNativeProjectForMacOSApplication(workspacePath?: string): void {
        const workspaceDirectory = workspacePath ? workspacePath : this.macOSRnWorkspaceDirectory;
        const macOSinitCommand = "npx react-native-macos-init";
        SmokeTestLogger.projectPatchingLog(`*** Installing the React Native for macOS packages via '${macOSinitCommand}' in ${workspaceDirectory}...`);
        utilities.execSync(macOSinitCommand, { cwd: workspaceDirectory, stdio: "inherit" }, vscodeManager.getSetupEnvironmentLogDir());
    }

    private prepareReactNativeProjectForHermesTesting(workspacePath?: string, sampleWorkspace?: string) {
        const workspaceDirectory = workspacePath ? workspacePath : this.hermesWorkspaceDirectory;
        const sampleWorkspaceDirectory = sampleWorkspace ? sampleWorkspace : null;
        const { workspaceEntryPointPath } = this.getKeyPathsForApplication(workspaceDirectory);
        const commandClean = path.join(workspaceDirectory, "android", "gradlew") + " clean";

        SmokeTestLogger.projectPatchingLog(`*** Patching React Native project for Hermes debugging`);

        SmokeTestLogger.projectPatchingLog(`*** Executing  ${commandClean} ...`);
        utilities.execSync(commandClean, { cwd: path.join(workspaceDirectory, "android"), stdio: "inherit" }, vscodeManager.getSetupEnvironmentLogDir());

        if (sampleWorkspaceDirectory) {
            const { customEntryPointPath, testButtonPath } = this.getKeyPathsForSample(sampleWorkspaceDirectory);

            SmokeTestLogger.projectPatchingLog(`*** Copying  ${customEntryPointPath} into ${workspaceEntryPointPath}...`);
            fs.writeFileSync(workspaceEntryPointPath, fs.readFileSync(customEntryPointPath));

            this.copyGradleFilesToHermesApp(workspaceDirectory, customEntryPointPath);

            SmokeTestLogger.projectPatchingLog(`*** Copying ${testButtonPath} into ${workspaceDirectory}`);
            fs.copyFileSync(testButtonPath, path.join(workspaceDirectory, "AppTestButton.js"));
        }
    }

    private getKeyPathsForApplication(workspacePath: string): { appName: string, parentPathForWorkspace: string, vsCodeConfigPath: string, workspaceEntryPointPath: string } {
        const appName = path.basename(workspacePath);
        const parentPathForWorkspace = path.join(workspacePath, "..");
        const vsCodeConfigPath = path.join(workspacePath, ".vscode");
        let workspaceEntryPointPath = path.join(workspacePath, SmokeTestsConstants.ApptsxFileName);
        if (!fs.existsSync(workspaceEntryPointPath)) {
            workspaceEntryPointPath = path.join(workspacePath, SmokeTestsConstants.AppjsFileName);
        }
        return { appName, parentPathForWorkspace, vsCodeConfigPath, workspaceEntryPointPath };
    }

    private getKeyPathsForSample(workspacePath: string): { testButtonPath: string, customEntryPointPath: string } {
        const testButtonPath = path.join(workspacePath, "AppTestButton.js");
        let customEntryPointPath = path.join(workspacePath, SmokeTestsConstants.ApptsxFileName);
        if (!fs.existsSync(customEntryPointPath)) {
            customEntryPointPath = path.join(workspacePath, SmokeTestsConstants.AppjsFileName);
        }

        return { testButtonPath, customEntryPointPath };
    }

    private generateReactNativeInitCommand(appName: string, version?: string): string {
        let command = "";
        if (appName === SmokeTestsConstants.RNWAppName) {
            command = `${utilities.npxCommand} --ignore-existing react-native init ${appName} --template react-native@^${version}`;
        } else {
            command = `react-native init ${appName}${version ? ` --version ${version}` : ""}`;
        }

        return command;
    }

    private prepareReactNativeApplication(workspacePath?: string, sampleWorkspace?: string, version?: string) {
        const workspaceDirectory = workspacePath ? workspacePath : this.rnWorkspaceDirectory;
        const sampleWorkspaceDirectory = sampleWorkspace ? sampleWorkspace : null;
        const { appName, parentPathForWorkspace, vsCodeConfigPath } = this.getKeyPathsForApplication(workspaceDirectory);

        const command = this.generateReactNativeInitCommand(appName, version);
        SmokeTestLogger.projectInstallLog(`*** Creating RN app via '${command}' in ${workspaceDirectory}...`);
        utilities.execSync(command, { cwd: parentPathForWorkspace, stdio: "inherit" }, vscodeManager.getSetupEnvironmentLogDir());

        const { workspaceEntryPointPath } = this.getKeyPathsForApplication(workspaceDirectory);

        if (sampleWorkspaceDirectory) {
            const { customEntryPointPath } = this.getKeyPathsForSample(sampleWorkspaceDirectory);
            SmokeTestLogger.projectPatchingLog(`*** Copying  ${customEntryPointPath} into ${workspaceEntryPointPath}...`);
            fs.writeFileSync(workspaceEntryPointPath, fs.readFileSync(customEntryPointPath));
        }

        if (!fs.existsSync(vsCodeConfigPath)) {
            SmokeTestLogger.projectInstallLog(`*** Creating  ${vsCodeConfigPath}...`);
            fs.mkdirSync(vsCodeConfigPath);
        }

        SmokeTestLogger.projectPatchingLog(`*** Copying  ${this.launchJsonPath} into ${vsCodeConfigPath}...`);
        fs.writeFileSync(path.join(vsCodeConfigPath, "launch.json"), fs.readFileSync(this.launchJsonPath));

        this.patchMetroConfig(workspaceDirectory);
    }

    private prepareExpoApplication(workspacePath?: string, sampleWorkspace?: string, expoSdkMajorVersion?: string) {
        const workspaceDirectory = workspacePath ? workspacePath : this.expoWorkspaceDirectory;
        const sampleWorkspaceDirectory = sampleWorkspace ? sampleWorkspace : null;
        const { appName, parentPathForWorkspace, vsCodeConfigPath } = this.getKeyPathsForApplication(workspaceDirectory);
        const useSpecificSdk = expoSdkMajorVersion ? `@sdk-${expoSdkMajorVersion}` : "";
        const command = `echo -ne '\\n' | expo init -t tabs${useSpecificSdk} --name ${appName} ${appName}`;

        SmokeTestLogger.projectInstallLog(`*** Creating Expo app via '${command}' in ${workspaceDirectory}...`);
        utilities.execSync(command, { cwd: parentPathForWorkspace, stdio: "inherit" }, vscodeManager.getSetupEnvironmentLogDir());

        const { workspaceEntryPointPath } = this.getKeyPathsForApplication(workspaceDirectory);

        if (sampleWorkspaceDirectory) {
            const { customEntryPointPath } = this.getKeyPathsForSample(sampleWorkspaceDirectory);
            SmokeTestLogger.projectPatchingLog(`*** Copying  ${customEntryPointPath} into ${workspaceEntryPointPath}...`);
            fs.writeFileSync(workspaceEntryPointPath, fs.readFileSync(customEntryPointPath));
        }

        if (!fs.existsSync(vsCodeConfigPath)) {
            SmokeTestLogger.projectInstallLog(`*** Creating  ${vsCodeConfigPath}...`);
            fs.mkdirSync(vsCodeConfigPath);
        }

        SmokeTestLogger.projectPatchingLog(`*** Copying  ${this.launchJsonPath} into ${vsCodeConfigPath}...`);
        fs.writeFileSync(path.join(vsCodeConfigPath, "launch.json"), fs.readFileSync(this.launchJsonPath));

        this.patchMetroConfig(workspaceDirectory);
        this.patchExpoSettingsFile();
    }

    private preparePureExpoApplication(workspacePath?: string, sampleWorkspace?: string, rnVersion?: string, expoVersion?: string) {
        const workspaceDirectory = workspacePath ? workspacePath : this.pureRnWorkspaceDirectory;
        const sampleWorkspaceDirectory = sampleWorkspace ? sampleWorkspace : this.pureRnSampleDirectory;

        this.prepareReactNativeApplication(workspaceDirectory, undefined, rnVersion);
        this.addExpoDependencyToRNProject(workspaceDirectory, sampleWorkspaceDirectory, expoVersion);
    }

    private prepareRNWApplication(workspacePath?: string, sampleWorkspace?: string, rnVersion?: string) {
        const workspaceDirectory = workspacePath ? workspacePath : this.windowsRnWorkspaceDirectory;
        const sampleWorkspaceDirectory = sampleWorkspace ? sampleWorkspace : this.windowsRnSampleDirectory;

        this.prepareReactNativeApplication(workspaceDirectory, sampleWorkspaceDirectory, rnVersion);
        this.prepareReactNativeProjectForWindowsApplication(workspaceDirectory);
    }

    private prepareMacOSApplication(workspacePath?: string, sampleWorkspace?: string, rnVersion?: string) {
        const workspaceDirectory = workspacePath ? workspacePath : this.macOSRnWorkspaceDirectory;
        const sampleWorkspaceDirectory = sampleWorkspace ? sampleWorkspace : this.macOSRnSampleDirectory;

        this.prepareReactNativeApplication(workspaceDirectory, sampleWorkspaceDirectory, rnVersion);
        this.prepareReactNativeProjectForMacOSApplication(workspaceDirectory);
    }

    private prepareHermesApplication(workspacePath?: string, sampleWorkspace?: string, rnVersion?: string) {
        const workspaceDirectory = workspacePath ? workspacePath : this.pureRnWorkspaceDirectory;
        const sampleWorkspaceDirectory = sampleWorkspace ? sampleWorkspace : this.hermesSampleDirectory;

        this.prepareReactNativeApplication(workspaceDirectory, undefined, rnVersion);
        this.prepareReactNativeProjectForHermesTesting(workspaceDirectory, sampleWorkspaceDirectory);
    }

    private addExpoDependencyToRNProject(workspacePath?: string, sampleWorkspace?: string, version?: string) {
        const workspaceDirectory = workspacePath ? workspacePath : this.pureRnWorkspaceDirectory;
        const sampleWorkspaceDirectory = sampleWorkspace ? sampleWorkspace : null;
        const { workspaceEntryPointPath } = this.getKeyPathsForApplication(workspaceDirectory);

        let expoPackage: string = version ? `expo@${version}` : "expo";
        const command = `${utilities.npmCommand} install ${expoPackage} --save-dev`;

        SmokeTestLogger.projectPatchingLog(`*** Adding expo dependency to ${workspaceDirectory} via '${command}' command...`);
        utilities.execSync(command, { cwd: workspaceDirectory, stdio: "inherit" }, vscodeManager.getSetupEnvironmentLogDir());

        if (sampleWorkspaceDirectory) {
            const { customEntryPointPath } = this.getKeyPathsForSample(sampleWorkspaceDirectory);
            SmokeTestLogger.projectPatchingLog(`*** Copying  ${customEntryPointPath} into ${workspaceEntryPointPath}...`);
            fs.writeFileSync(workspaceEntryPointPath, fs.readFileSync(customEntryPointPath));
        }
    }

    private copyGradleFilesToHermesApp(workspacePath: string, customEntryPointPath: string) {
        const appGradleBuildFilePath = path.join(workspacePath, "android", "app", "build.gradle");
        const resGradleBuildFilePath = path.join(customEntryPointPath, "..", "build.gradle");

        SmokeTestLogger.projectPatchingLog(`*** Copying  ${resGradleBuildFilePath} into ${appGradleBuildFilePath}...`);
        fs.writeFileSync(appGradleBuildFilePath, fs.readFileSync(resGradleBuildFilePath));
    }

    private patchMetroConfig(appPath: string) {
        const metroConfigPath = path.join(appPath, "metro.config.js");
        SmokeTestLogger.projectPatchingLog(`*** Patching  ${metroConfigPath}`);
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
        SmokeTestLogger.projectPatchingLog(`*** Content of a metro.config.js after patching: ${contentAfterPatching}`);
    }

    public cleanUp(): void {

        if (fs.existsSync(this.testAppsDirectory)) {
            SmokeTestLogger.info(`*** Deleting tests application directory: ${this.testAppsDirectory}`);
            rimraf.sync(this.testAppsDirectory);
        }

        if (fs.existsSync(SmokeTestsConstants.iOSExpoAppsCacheDir)) {
            SmokeTestLogger.info(`*** Deleting iOS expo app cache directory: ${SmokeTestsConstants.iOSExpoAppsCacheDir}`);
            rimraf.sync(SmokeTestsConstants.iOSExpoAppsCacheDir);
        }
    }

    // Fix for https://github.com/expo/expo-cli/issues/951
    // TODO: Delete when bug will be fixed
    private patchExpoSettingsFile() {
        const settingsJsonPath = path.join(this.expoWorkspaceDirectory, ".expo", "settings.json");
        if (fs.existsSync(settingsJsonPath)) {
            SmokeTestLogger.projectPatchingLog(`*** Patching ${settingsJsonPath}...`);
            let content = JSON.parse(fs.readFileSync(settingsJsonPath).toString());
            if (content.https === false) {
                SmokeTestLogger.projectPatchingLog(`*** Deleting https: ${content.https} line...`);
                delete content.https;
                content = JSON.stringify(content, null, 2);
                fs.writeFileSync(settingsJsonPath, content);
            }
        }
    }

}