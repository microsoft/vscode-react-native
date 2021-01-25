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

export interface TestProject {
    workspaceDirectory: string;
    sampleDirectory: string;
    projectMainFilePath: string;
}

export class TestApplicationSetupManager {
    private cacheDirectory: string;
    private testAppsDirectory: string;

    private rnTestProject: TestProject = {
        workspaceDirectory: "",
        sampleDirectory: "",
        projectMainFilePath: "",
    };
    private hermesTestProject: TestProject = {
        workspaceDirectory: "",
        sampleDirectory: "",
        projectMainFilePath: "",
    };
    private pureRNTestProject: TestProject = {
        workspaceDirectory: "",
        sampleDirectory: "",
        projectMainFilePath: "",
    };
    private windowsTestProject: TestProject = {
        workspaceDirectory: "",
        sampleDirectory: "",
        projectMainFilePath: "",
    };
    private macOSTestProject: TestProject = {
        workspaceDirectory: "",
        sampleDirectory: "",
        projectMainFilePath: "",
    };
    private expoTestProject: TestProject = {
        workspaceDirectory: "",
        sampleDirectory: "",
        projectMainFilePath: "",
    };

    private launchJsonPath: string;

    constructor(resourcesDirectory: string, cacheDirectory: string) {
        this.testAppsDirectory = path.join(cacheDirectory, "TestApps");
        this.cacheDirectory = cacheDirectory;

        this.rnTestProject.workspaceDirectory = path.join(
            this.testAppsDirectory,
            SmokeTestsConstants.RNAppName,
        );
        this.hermesTestProject.workspaceDirectory = path.join(
            this.testAppsDirectory,
            SmokeTestsConstants.HermesAppName,
        );
        this.pureRNTestProject.workspaceDirectory = path.join(
            this.testAppsDirectory,
            SmokeTestsConstants.pureRNExpoAppName,
        );
        this.macOSTestProject.workspaceDirectory = path.join(
            this.testAppsDirectory,
            SmokeTestsConstants.RNmacOSAppName,
        );
        this.windowsTestProject.workspaceDirectory = path.join(
            this.testAppsDirectory,
            SmokeTestsConstants.RNWAppName,
        );
        this.expoTestProject.workspaceDirectory = path.join(
            this.testAppsDirectory,
            SmokeTestsConstants.ExpoAppName,
        );

        this.rnTestProject.sampleDirectory = path.join(
            resourcesDirectory,
            SmokeTestsConstants.sampleRNAppName,
        );
        this.hermesTestProject.sampleDirectory = path.join(
            resourcesDirectory,
            SmokeTestsConstants.sampleHermesAppName,
        );
        this.pureRNTestProject.sampleDirectory = path.join(
            resourcesDirectory,
            SmokeTestsConstants.samplePureRNExpoAppName,
        );
        this.macOSTestProject.sampleDirectory = path.join(
            resourcesDirectory,
            SmokeTestsConstants.sampleRNmacOSAppName,
        );
        this.windowsTestProject.sampleDirectory = path.join(
            resourcesDirectory,
            SmokeTestsConstants.sampleRNWAppName,
        );
        this.expoTestProject.sampleDirectory = path.join(
            resourcesDirectory,
            SmokeTestsConstants.sampleExpoAppName,
        );

        this.launchJsonPath = path.join(resourcesDirectory, "launch.json");
    }

    public getMacOSRnWorkspaceDirectory(): string {
        return this.macOSTestProject.workspaceDirectory;
    }

    public getWindowsRnWorkspaceDirectory(): string {
        return this.windowsTestProject.workspaceDirectory;
    }

    public getRnWorkspaceDirectory(): string {
        return this.rnTestProject.workspaceDirectory;
    }

    public getHermesWorkspaceDirectory(): string {
        return this.hermesTestProject.workspaceDirectory;
    }

    public getPureRnWorkspaceDirectory(): string {
        return this.pureRNTestProject.workspaceDirectory;
    }

    public getExpoWorkspaceDirectory(): string {
        return this.expoTestProject.workspaceDirectory;
    }

    public async prepareTestApplications(useCachedApplications: boolean): Promise<void> {
        SmokeTestLogger.projectInstallLog("*** Preparing smoke tests applications...");

        if (!fs.existsSync(this.cacheDirectory)) {
            SmokeTestLogger.projectInstallLog(
                `*** Creating smoke tests cache directory: ${this.cacheDirectory}`,
            );
            fs.mkdirSync(this.cacheDirectory);
        }
        if (!fs.existsSync(this.testAppsDirectory)) {
            SmokeTestLogger.projectInstallLog(
                `*** Creating test apps directory: ${this.testAppsDirectory}`,
            );
            fs.mkdirSync(this.testAppsDirectory);
        }

        const rnVersion = process.env.RN_VERSION || "";
        const pureRnVersion =
            process.env.PURE_RN_VERSION ||
            (await TestApplicationSetupManager.getLatestSupportedRNVersionForExpo(
                process.env.EXPO_SDK_MAJOR_VERSION,
            ));
        const expoSdkVersion = process.env.EXPO_SDK_MAJOR_VERSION || "";
        const pureExpoSdkVersion = process.env.PURE_EXPO_VERSION || "";
        const macOSrnVersion = process.env.RN_MAC_OS_VERSION || "";
        const rnwVersion = process.env.RNW_VERSION || "";

        this.prepareWithCacheMiddleware(
            this.rnTestProject.workspaceDirectory,
            rnVersion,
            useCachedApplications,
            false,
            () => {
                this.prepareReactNativeApplication(
                    this.rnTestProject.workspaceDirectory,
                    this.rnTestProject.sampleDirectory,
                    rnVersion,
                );
            },
        );
        this.prepareWithCacheMiddleware(
            this.expoTestProject.workspaceDirectory,
            expoSdkVersion,
            useCachedApplications,
            true,
            () => {
                this.prepareExpoApplication(
                    this.expoTestProject.workspaceDirectory,
                    this.expoTestProject.sampleDirectory,
                    expoSdkVersion,
                );
            },
        );
        this.prepareWithCacheMiddleware(
            this.pureRNTestProject.workspaceDirectory,
            pureRnVersion,
            useCachedApplications,
            false,
            () => {
                this.preparePureExpoApplication(
                    this.pureRNTestProject.workspaceDirectory,
                    this.pureRNTestProject.sampleDirectory,
                    pureRnVersion,
                    pureExpoSdkVersion,
                );
            },
        );
        this.prepareWithCacheMiddleware(
            this.hermesTestProject.workspaceDirectory,
            rnVersion,
            useCachedApplications,
            false,
            () => {
                this.prepareHermesApplication(
                    this.hermesTestProject.workspaceDirectory,
                    this.hermesTestProject.sampleDirectory,
                    rnVersion,
                );
            },
        );

        if (process.platform === "darwin") {
            this.prepareWithCacheMiddleware(
                this.macOSTestProject.workspaceDirectory,
                macOSrnVersion,
                useCachedApplications,
                false,
                () => {
                    this.prepareMacOSApplication(
                        this.macOSTestProject.workspaceDirectory,
                        this.macOSTestProject.sampleDirectory,
                        macOSrnVersion,
                    );
                },
            );
        }
        if (process.platform === "win32") {
            this.prepareWithCacheMiddleware(
                this.windowsTestProject.workspaceDirectory,
                rnwVersion,
                useCachedApplications,
                false,
                () => {
                    this.prepareRNWApplication(
                        this.windowsTestProject.workspaceDirectory,
                        this.windowsTestProject.sampleDirectory,
                        rnwVersion,
                    );
                },
            );
        }
    }

    public cleanUp(saveCache?: boolean): void {
        if (fs.existsSync(this.testAppsDirectory) && !saveCache) {
            SmokeTestLogger.info(
                `*** Deleting tests application directory: ${this.testAppsDirectory}`,
            );
            rimraf.sync(this.testAppsDirectory);
        }

        if (fs.existsSync(SmokeTestsConstants.iOSExpoAppsCacheDir)) {
            SmokeTestLogger.info(
                `*** Deleting iOS expo app cache directory: ${SmokeTestsConstants.iOSExpoAppsCacheDir}`,
            );
            rimraf.sync(SmokeTestsConstants.iOSExpoAppsCacheDir);
        }

        if (fs.existsSync(SmokeTestsConstants.ExpoVersionsJsonFilePath)) {
            SmokeTestLogger.info(
                `*** Deleting Expo versions.json file: ${SmokeTestsConstants.ExpoVersionsJsonFilePath}`,
            );
            fs.unlinkSync(SmokeTestsConstants.ExpoVersionsJsonFilePath);
        }
    }

    public copyDebuggingConfigurationsToProject(launchJsonFilePathInProject: string): void {
        SmokeTestLogger.projectPatchingLog(
            `*** Copying  ${this.launchJsonPath} into ${launchJsonFilePathInProject}...`,
        );
        fs.writeFileSync(
            path.join(launchJsonFilePathInProject, "launch.json"),
            fs.readFileSync(this.launchJsonPath),
        );
    }

    private static async getLatestSupportedRNVersionForExpo(
        expoSdkMajorVersion?: string,
    ): Promise<any> {
        const printSpecifiedMajorVersion = expoSdkMajorVersion ? `sdk-${expoSdkMajorVersion}` : "";
        const printIsLatest = printSpecifiedMajorVersion ? "" : "latest ";
        SmokeTestLogger.info(
            `*** Getting latest React Native version supported by ${printIsLatest}Expo ${printSpecifiedMajorVersion}...`,
        );
        return new Promise((resolve, reject) => {
            utilities.getContents(
                "https://exp.host/--/api/v2/versions",
                null,
                null,
                function (error, versionsContent) {
                    if (error) {
                        reject(error);
                    }
                    try {
                        const content = JSON.parse(versionsContent);
                        if (content.sdkVersions) {
                            let usesSdkVersion: string | undefined;
                            if (expoSdkMajorVersion) {
                                usesSdkVersion = Object.keys(content.sdkVersions).find(
                                    version =>
                                        semver.major(version) === parseInt(expoSdkMajorVersion),
                                );
                                if (!usesSdkVersion) {
                                    SmokeTestLogger.warn(
                                        `*** Сould not find the version of Expo sdk matching the specified version - ${printSpecifiedMajorVersion}`,
                                    );
                                }
                            }
                            if (!usesSdkVersion) {
                                usesSdkVersion = Object.keys(content.sdkVersions).sort(
                                    (ver1, ver2) => {
                                        if (semver.lt(ver1, ver2)) {
                                            return 1;
                                        } else if (semver.gt(ver1, ver2)) {
                                            return -1;
                                        }
                                        return 0;
                                    },
                                )[0];
                            }
                            if (content.sdkVersions[usesSdkVersion]) {
                                if (
                                    content.sdkVersions[usesSdkVersion].facebookReactNativeVersion
                                ) {
                                    SmokeTestLogger.success(
                                        `*** Latest React Native version supported by Expo ${printSpecifiedMajorVersion}: ${content.sdkVersions[usesSdkVersion].facebookReactNativeVersion}`,
                                    );
                                    resolve(
                                        content.sdkVersions[usesSdkVersion]
                                            .facebookReactNativeVersion as string,
                                    );
                                }
                            }
                        }
                        reject("Received object is incorrect");
                    } catch (error) {
                        reject(error);
                    }
                },
            );
        });
    }

    private prepareWithCacheMiddleware(
        workspacePath: string,
        packageVersion: string,
        useCachedApplications: boolean,
        isExpoProject: boolean,
        prepareProjectFunc: () => void,
    ): void {
        if (
            !this.useCachedApps(workspacePath, packageVersion, useCachedApplications, isExpoProject)
        ) {
            this.removeProjectFolder(workspacePath);
            prepareProjectFunc.call(this);
        } else {
            if (
                workspacePath.includes(SmokeTestsConstants.RNAppName) ||
                workspacePath.includes(SmokeTestsConstants.HermesAppName)
            ) {
                this.execGradlewCleanCommand(workspacePath);
            }
            SmokeTestLogger.projectInstallLog(`Use the cached project by path ${workspacePath}`);
        }
    }

    private prepareReactNativeProjectForWindowsApplication(workspacePath: string): void {
        const command = `${utilities.npxCommand} react-native-windows-init --overwrite`;
        SmokeTestLogger.projectPatchingLog(`*** Install additional RNW packages using ${command}`);
        utilities.execSync(
            command,
            { cwd: workspacePath },
            vscodeManager.getSetupEnvironmentLogDir(),
        );
    }

    private prepareReactNativeProjectForMacOSApplication(
        workspacePath?: string,
        sampleWorkspace?: string,
    ): void {
        const workspaceDirectory = workspacePath
            ? workspacePath
            : this.macOSTestProject.workspaceDirectory;
        const sampleWorkspaceDirectory = sampleWorkspace ? sampleWorkspace : null;

        const macOSinitCommand = "npx react-native-macos-init";
        SmokeTestLogger.projectPatchingLog(
            `*** Installing the React Native for macOS packages via '${macOSinitCommand}' in ${workspaceDirectory}...`,
        );
        utilities.execSync(
            macOSinitCommand,
            { cwd: workspaceDirectory },
            vscodeManager.getSetupEnvironmentLogDir(),
        );

        if (sampleWorkspaceDirectory) {
            const { customEntryPointPath } = this.getKeyPathsForSample(sampleWorkspaceDirectory);
            const { workspaceEntryPointPath } = this.getKeyPathsForApplication(workspaceDirectory);
            this.macOSTestProject.projectMainFilePath = workspaceEntryPointPath;
            SmokeTestLogger.projectPatchingLog(
                `*** Copying  ${customEntryPointPath} into ${workspaceEntryPointPath}...`,
            );
            fs.writeFileSync(workspaceEntryPointPath, fs.readFileSync(customEntryPointPath));
        }
    }

    private prepareReactNativeProjectForHermesTesting(
        workspacePath?: string,
        sampleWorkspace?: string,
    ) {
        const workspaceDirectory = workspacePath
            ? workspacePath
            : this.hermesTestProject.workspaceDirectory;
        const sampleWorkspaceDirectory = sampleWorkspace ? sampleWorkspace : null;
        const { workspaceEntryPointPath } = this.getKeyPathsForApplication(workspaceDirectory);
        this.hermesTestProject.projectMainFilePath = workspaceEntryPointPath;

        SmokeTestLogger.projectPatchingLog(
            `*** Patching React Native project for Hermes debugging`,
        );
        this.execGradlewCleanCommand(workspaceDirectory);

        if (sampleWorkspaceDirectory) {
            const { customEntryPointPath, testButtonPath } = this.getKeyPathsForSample(
                sampleWorkspaceDirectory,
            );

            SmokeTestLogger.projectPatchingLog(
                `*** Copying  ${customEntryPointPath} into ${workspaceEntryPointPath}...`,
            );
            fs.writeFileSync(workspaceEntryPointPath, fs.readFileSync(customEntryPointPath));

            this.copyGradleFilesFromSample(workspaceDirectory, sampleWorkspaceDirectory);
            this.copyPodfileFromSample(workspaceDirectory, sampleWorkspaceDirectory);

            SmokeTestLogger.projectPatchingLog(
                `*** Copying ${testButtonPath} into ${workspaceDirectory}`,
            );
            fs.copyFileSync(testButtonPath, path.join(workspaceDirectory, "AppTestButton.js"));
        }
    }

    private getKeyPathsForApplication(
        workspacePath: string,
    ): {
        appName: string;
        parentPathForWorkspace: string;
        vsCodeConfigPath: string;
        workspaceEntryPointPath: string;
    } {
        const appName = path.basename(workspacePath);
        const parentPathForWorkspace = path.join(workspacePath, "..");
        const vsCodeConfigPath = path.join(workspacePath, ".vscode");
        let workspaceEntryPointPath = path.join(workspacePath, SmokeTestsConstants.ApptsxFileName);
        if (!fs.existsSync(workspaceEntryPointPath)) {
            workspaceEntryPointPath = path.join(workspacePath, SmokeTestsConstants.AppjsFileName);
        }
        return { appName, parentPathForWorkspace, vsCodeConfigPath, workspaceEntryPointPath };
    }

    private getKeyPathsForSample(
        workspacePath: string,
    ): { testButtonPath: string; customEntryPointPath: string } {
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

    private prepareReactNativeApplication(
        workspacePath: string,
        sampleWorkspace?: string,
        version?: string,
    ) {
        const sampleWorkspaceDirectory = sampleWorkspace ? sampleWorkspace : null;
        const {
            appName,
            parentPathForWorkspace,
            vsCodeConfigPath,
        } = this.getKeyPathsForApplication(workspacePath);

        const command = this.generateReactNativeInitCommand(appName, version);
        SmokeTestLogger.projectInstallLog(
            `*** Creating RN app via '${command}' in ${workspacePath}...`,
        );
        utilities.execSync(
            command,
            { cwd: parentPathForWorkspace },
            vscodeManager.getSetupEnvironmentLogDir(),
        );

        const { workspaceEntryPointPath } = this.getKeyPathsForApplication(workspacePath);
        this.rnTestProject.projectMainFilePath = workspaceEntryPointPath;

        if (sampleWorkspaceDirectory) {
            const { customEntryPointPath } = this.getKeyPathsForSample(sampleWorkspaceDirectory);
            SmokeTestLogger.projectPatchingLog(
                `*** Copying  ${customEntryPointPath} into ${workspaceEntryPointPath}...`,
            );
            fs.writeFileSync(workspaceEntryPointPath, fs.readFileSync(customEntryPointPath));
        }

        if (!fs.existsSync(vsCodeConfigPath)) {
            SmokeTestLogger.projectInstallLog(`*** Creating  ${vsCodeConfigPath}...`);
            fs.mkdirSync(vsCodeConfigPath);
        }

        this.copyDebuggingConfigurationsToProject(vsCodeConfigPath);

        this.patchMetroConfig(workspacePath);
    }

    private prepareExpoApplication(
        workspacePath: string,
        sampleWorkspace?: string,
        expoSdkMajorVersion?: string,
    ) {
        const sampleWorkspaceDirectory = sampleWorkspace ? sampleWorkspace : null;
        const {
            appName,
            parentPathForWorkspace,
            vsCodeConfigPath,
        } = this.getKeyPathsForApplication(workspacePath);
        const useSpecificSdk = expoSdkMajorVersion ? `@sdk-${expoSdkMajorVersion}` : "";
        const command = `echo -ne '\\n' | expo init -t tabs${useSpecificSdk} --name ${appName} ${appName}`;

        SmokeTestLogger.projectInstallLog(
            `*** Creating Expo app via '${command}' in ${workspacePath}...`,
        );
        utilities.execSync(
            command,
            { cwd: parentPathForWorkspace },
            vscodeManager.getSetupEnvironmentLogDir(),
        );

        const { workspaceEntryPointPath } = this.getKeyPathsForApplication(workspacePath);
        this.expoTestProject.projectMainFilePath = workspaceEntryPointPath;

        if (sampleWorkspaceDirectory) {
            const { customEntryPointPath } = this.getKeyPathsForSample(sampleWorkspaceDirectory);
            SmokeTestLogger.projectPatchingLog(
                `*** Copying  ${customEntryPointPath} into ${workspaceEntryPointPath}...`,
            );
            fs.writeFileSync(workspaceEntryPointPath, fs.readFileSync(customEntryPointPath));
        }

        if (!fs.existsSync(vsCodeConfigPath)) {
            SmokeTestLogger.projectInstallLog(`*** Creating  ${vsCodeConfigPath}...`);
            fs.mkdirSync(vsCodeConfigPath);
        }

        this.copyDebuggingConfigurationsToProject(vsCodeConfigPath);

        this.patchMetroConfig(workspacePath);
        this.patchExpoSettingsFile();
    }

    private preparePureExpoApplication(
        workspacePath: string,
        sampleWorkspace?: string,
        rnVersion?: string,
        expoVersion?: string,
    ) {
        const sampleWorkspaceDirectory = sampleWorkspace
            ? sampleWorkspace
            : this.pureRNTestProject.sampleDirectory;

        this.prepareReactNativeApplication(workspacePath, undefined, rnVersion);
        this.addExpoDependencyToRNProject(workspacePath, sampleWorkspaceDirectory, expoVersion);
    }

    private prepareRNWApplication(
        workspacePath: string,
        sampleWorkspace?: string,
        rnVersion?: string,
    ) {
        const sampleWorkspaceDirectory = sampleWorkspace
            ? sampleWorkspace
            : this.windowsTestProject.sampleDirectory;

        this.prepareReactNativeApplication(workspacePath, sampleWorkspaceDirectory, rnVersion);
        this.prepareReactNativeProjectForWindowsApplication(workspacePath);
    }

    private prepareMacOSApplication(
        workspacePath: string,
        sampleWorkspace?: string,
        rnVersion?: string,
    ) {
        const sampleWorkspaceDirectory = sampleWorkspace
            ? sampleWorkspace
            : this.macOSTestProject.sampleDirectory;

        this.prepareReactNativeApplication(workspacePath, sampleWorkspaceDirectory, rnVersion);
        this.prepareReactNativeProjectForMacOSApplication(workspacePath);
    }

    private prepareHermesApplication(
        workspacePath: string,
        sampleWorkspace?: string,
        rnVersion?: string,
    ) {
        const sampleWorkspaceDirectory = sampleWorkspace
            ? sampleWorkspace
            : this.hermesTestProject.sampleDirectory;

        this.prepareReactNativeApplication(workspacePath, undefined, rnVersion);
        this.prepareReactNativeProjectForHermesTesting(workspacePath, sampleWorkspaceDirectory);
    }

    private addExpoDependencyToRNProject(
        workspacePath?: string,
        sampleWorkspace?: string,
        version?: string,
    ) {
        const workspaceDirectory = workspacePath
            ? workspacePath
            : this.pureRNTestProject.workspaceDirectory;
        const sampleWorkspaceDirectory = sampleWorkspace ? sampleWorkspace : null;
        const { workspaceEntryPointPath } = this.getKeyPathsForApplication(workspaceDirectory);
        this.pureRNTestProject.projectMainFilePath = workspaceEntryPointPath;

        let expoPackage: string = version ? `expo@${version}` : "expo";
        const command = `${utilities.npmCommand} install ${expoPackage} --save-dev`;

        SmokeTestLogger.projectPatchingLog(
            `*** Adding expo dependency to ${workspaceDirectory} via '${command}' command...`,
        );
        utilities.execSync(
            command,
            { cwd: workspaceDirectory },
            vscodeManager.getSetupEnvironmentLogDir(),
        );

        if (sampleWorkspaceDirectory) {
            const { customEntryPointPath } = this.getKeyPathsForSample(sampleWorkspaceDirectory);
            SmokeTestLogger.projectPatchingLog(
                `*** Copying  ${customEntryPointPath} into ${workspaceEntryPointPath}...`,
            );
            fs.writeFileSync(workspaceEntryPointPath, fs.readFileSync(customEntryPointPath));
        }
    }

    private copyGradleFilesFromSample(workspacePath: string, sampleWorkspace: string) {
        const appGradleBuildFilePath = path.join(workspacePath, "android", "app", "build.gradle");
        const resGradleBuildFilePath = path.join(sampleWorkspace, "build.gradle");

        SmokeTestLogger.projectPatchingLog(
            `*** Copying  ${resGradleBuildFilePath} into ${appGradleBuildFilePath}...`,
        );
        fs.writeFileSync(appGradleBuildFilePath, fs.readFileSync(resGradleBuildFilePath));
    }

    private copyPodfileFromSample(workspacePath: string, sampleWorkspace: string) {
        const appPodfilePath = path.join(workspacePath, "ios", "Podfile");
        const resPodfilePath = path.join(sampleWorkspace, "Podfile");

        SmokeTestLogger.projectPatchingLog(
            `*** Copying  ${resPodfilePath} into ${appPodfilePath}...`,
        );
        fs.writeFileSync(appPodfilePath, fs.readFileSync(resPodfilePath));
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
        SmokeTestLogger.projectPatchingLog(
            `*** Content of a metro.config.js after patching: ${contentAfterPatching}`,
        );
    }

    private removeProjectFolder(projectPath: string) {
        if (fs.existsSync(projectPath)) {
            SmokeTestLogger.info(`*** Deleting project directory: ${projectPath}`);
            rimraf.sync(projectPath);
        }
    }

    // Fix for https://github.com/expo/expo-cli/issues/951
    // TODO: Delete when bug will be fixed
    private patchExpoSettingsFile() {
        const settingsJsonPath = path.join(
            this.expoTestProject.workspaceDirectory,
            ".expo",
            "settings.json",
        );
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

    private useCachedApps(
        workspacePath: string,
        packageVersion: string,
        useCachedApplications: boolean,
        isExpoProject: boolean,
    ): boolean {
        const packageJsonPath = path.join(workspacePath, "package.json");
        if (!useCachedApplications || !fs.existsSync(packageJsonPath)) {
            return false;
        }

        let useCachedApp = false;

        try {
            const packageJsonData = JSON.parse(fs.readFileSync(packageJsonPath).toString());

            if (isExpoProject) {
                if (
                    packageJsonData.dependencies.expo.includes(packageVersion) ||
                    packageJsonData.devDependencies.expo.includes(packageVersion)
                ) {
                    useCachedApp = true;
                }
            } else if (packageJsonData.dependencies["react-native"].includes(packageVersion)) {
                useCachedApp = true;
            }
        } catch (err) {
            // Do nothing
        }

        return useCachedApp;
    }

    private execGradlewCleanCommand(workspaceDirectory: string): void {
        const commandClean = path.join(workspaceDirectory, "android", "gradlew") + " clean";

        SmokeTestLogger.projectPatchingLog(`*** Executing  ${commandClean} ...`);
        utilities.execSync(
            commandClean,
            { cwd: path.join(workspaceDirectory, "android") },
            vscodeManager.getSetupEnvironmentLogDir(),
        );
    }
}
