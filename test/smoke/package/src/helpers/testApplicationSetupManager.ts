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
import TestProject from "./testProject";

export class TestApplicationSetupManager {
    private cacheDirectory: string;
    private testAppsDirectory: string;

    private rnTestProject: TestProject;
    private hermesTestProject: TestProject;
    private pureRNTestProject: TestProject;
    private windowsTestProject: TestProject;
    private macOSTestProject: TestProject;
    private macOSHermesTestProject: TestProject;
    private expoTestProject: TestProject;

    private launchJsonPath: string;

    constructor(resourcesDirectory: string, cacheDirectory: string) {
        this.testAppsDirectory = path.join(cacheDirectory, "TestApps");
        this.cacheDirectory = cacheDirectory;

        this.rnTestProject = new TestProject(
            path.join(this.testAppsDirectory, SmokeTestsConstants.RNAppName),
            path.join(resourcesDirectory, SmokeTestsConstants.sampleRNAppName),
        );
        this.hermesTestProject = new TestProject(
            path.join(this.testAppsDirectory, SmokeTestsConstants.HermesAppName),
            path.join(resourcesDirectory, SmokeTestsConstants.sampleHermesAppName),
        );
        this.pureRNTestProject = new TestProject(
            path.join(this.testAppsDirectory, SmokeTestsConstants.pureRNExpoAppName),
            path.join(resourcesDirectory, SmokeTestsConstants.samplePureRNExpoAppName),
        );
        this.macOSTestProject = new TestProject(
            path.join(this.testAppsDirectory, SmokeTestsConstants.RNmacOSAppName),
            path.join(resourcesDirectory, SmokeTestsConstants.sampleRNmacOSAppName),
        );
        this.macOSHermesTestProject = new TestProject(
            path.join(this.testAppsDirectory, SmokeTestsConstants.RNmacOSHermesAppName),
            path.join(resourcesDirectory, SmokeTestsConstants.sampleRNmacOSHermesAppName),
        );
        this.windowsTestProject = new TestProject(
            path.join(this.testAppsDirectory, SmokeTestsConstants.RNWAppName),
            path.join(resourcesDirectory, SmokeTestsConstants.sampleRNWAppName),
        );
        this.expoTestProject = new TestProject(
            path.join(this.testAppsDirectory, SmokeTestsConstants.ExpoAppName),
            path.join(resourcesDirectory, SmokeTestsConstants.sampleExpoAppName),
        );

        this.launchJsonPath = path.join(resourcesDirectory, "launch.json");
    }

    public getMacOSRnProject(): TestProject {
        return this.macOSTestProject;
    }

    public getMacOSRnHermesProject(): TestProject {
        return this.macOSHermesTestProject;
    }

    public getWindowsRnProject(): TestProject {
        return this.windowsTestProject;
    }

    public getRnProject(): TestProject {
        return this.rnTestProject;
    }

    public getHermesProject(): TestProject {
        return this.hermesTestProject;
    }

    public getPureRnProject(): TestProject {
        return this.pureRNTestProject;
    }

    public getExpoProject(): TestProject {
        return this.expoTestProject;
    }

    public async prepareTestApplications(useCachedApplications: boolean): Promise<void> {
        SmokeTestLogger.projectInstallLog(
            `*** Preparing smoke tests applications${
                useCachedApplications ? " using cache" : ""
            }...`,
        );

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

        const packagesForReactNativeProjects = new Map<string, string>(
            Object.entries({ "react-native": rnVersion }),
        );
        const packagesForPureReactNativeProjects = new Map<string, string>(
            Object.entries({ "react-native": pureRnVersion, expo: pureExpoSdkVersion }),
        );
        const packagesForExpoProjects = new Map<string, string>(
            Object.entries({ expo: expoSdkVersion }),
        );
        const packagesForMacOsReactNativeProjects = new Map<string, string>(
            Object.entries({ "react-native": macOSrnVersion }),
        );
        const packagesForReactNativeWindowsProjects = new Map<string, string>(
            Object.entries({ "react-native": rnwVersion }),
        );

        this.prepareWithCacheMiddleware(
            this.rnTestProject,
            packagesForReactNativeProjects,
            useCachedApplications,
            () => {
                this.prepareReactNativeApplication(this.rnTestProject, rnVersion);
            },
        );
        this.prepareWithCacheMiddleware(
            this.expoTestProject,
            packagesForExpoProjects,
            useCachedApplications,
            () => {
                this.prepareExpoApplication(this.expoTestProject, expoSdkVersion);
            },
        );
        this.prepareWithCacheMiddleware(
            this.pureRNTestProject,
            packagesForPureReactNativeProjects,
            useCachedApplications,
            () => {
                this.preparePureExpoApplication(
                    this.pureRNTestProject,
                    pureRnVersion,
                    pureExpoSdkVersion,
                );
            },
        );
        this.prepareWithCacheMiddleware(
            this.hermesTestProject,
            packagesForReactNativeProjects,
            useCachedApplications,
            () => {
                this.prepareHermesApplication(this.hermesTestProject, rnVersion);
            },
        );

        if (process.platform === "darwin") {
            this.prepareWithCacheMiddleware(
                this.macOSTestProject,
                packagesForMacOsReactNativeProjects,
                useCachedApplications,
                () => {
                    this.prepareMacOSApplication(this.macOSTestProject, macOSrnVersion);
                },
            );

            this.prepareWithCacheMiddleware(
                this.macOSHermesTestProject,
                packagesForMacOsReactNativeProjects,
                useCachedApplications,
                () => {
                    this.prepareMacOSHermesApplication(this.macOSHermesTestProject, macOSrnVersion);
                },
            );
        }
        if (process.platform === "win32") {
            this.prepareWithCacheMiddleware(
                this.windowsTestProject,
                packagesForReactNativeWindowsProjects,
                useCachedApplications,
                () => {
                    this.prepareRNWApplication(this.windowsTestProject, rnwVersion);
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

    public copyDebuggingConfigurationsToProject(project: TestProject): void {
        SmokeTestLogger.projectPatchingLog(
            `*** Copying  ${this.launchJsonPath} into ${project.vsCodeConfigPath}...`,
        );
        fs.writeFileSync(
            path.join(project.vsCodeConfigPath, "launch.json"),
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
        project: TestProject,
        packagesVersions: Map<string, string>,
        useCachedApplications: boolean,
        prepareProjectFunc: () => void,
    ): void {
        if (!this.useCachedApps(project, packagesVersions, useCachedApplications)) {
            this.removeProjectFolder(project);
            prepareProjectFunc.call(this);
        } else {
            if (
                project.workspaceDirectory.includes(SmokeTestsConstants.RNAppName) ||
                project.workspaceDirectory.includes(SmokeTestsConstants.HermesAppName)
            ) {
                this.execGradlewCleanCommand(project);
            }
            SmokeTestLogger.projectInstallLog(
                `Use the cached project by path ${project.workspaceDirectory}`,
            );
        }
    }

    private prepareReactNativeProjectForWindowsApplication(project: TestProject): void {
        const command = `${utilities.npxCommand} react-native-windows-init --overwrite`;
        SmokeTestLogger.projectPatchingLog(`*** Install additional RNW packages using ${command}`);
        utilities.execSync(
            command,
            { cwd: project.workspaceDirectory },
            vscodeManager.getSetupEnvironmentLogDir(),
        );
    }

    private prepareReactNativeProjectForMacOSApplication(project: TestProject): void {
        const macOSinitCommand = "npx react-native-macos-init";
        SmokeTestLogger.projectPatchingLog(
            `*** Installing the React Native for macOS packages via '${macOSinitCommand}' in ${project.workspaceDirectory}...`,
        );
        utilities.execSync(
            macOSinitCommand,
            { cwd: project.workspaceDirectory },
            vscodeManager.getSetupEnvironmentLogDir(),
        );

        SmokeTestLogger.projectPatchingLog(
            `*** Copying  ${project.sampleEntryPointPath} into ${project.projectEntryPointPath}...`,
        );
        fs.writeFileSync(
            project.projectEntryPointPath,
            fs.readFileSync(project.sampleEntryPointPath),
        );
    }

    private prepareReactNativeProjectForMacOSHermesApplication(project: TestProject): void {
        const hermesEngineDarwinInstallCommand = "yarn add hermes-engine-darwin@^0.4.3";
        SmokeTestLogger.projectPatchingLog(
            `*** Installing the hermes-engine-darwin package via '${hermesEngineDarwinInstallCommand}' in ${project.workspaceDirectory}...`,
        );
        utilities.execSync(
            hermesEngineDarwinInstallCommand,
            { cwd: project.workspaceDirectory },
            vscodeManager.getSetupEnvironmentLogDir(),
        );

        this.copyPodfileFromSample(project, "macos");
        this.execPodInstallCommand(project, "macos");
    }

    private prepareReactNativeProjectForHermesTesting(project: TestProject) {
        SmokeTestLogger.projectPatchingLog(
            `*** Patching React Native project for Hermes debugging`,
        );

        SmokeTestLogger.projectPatchingLog(
            `*** Copying  ${project.sampleEntryPointPath} into ${project.projectEntryPointPath}...`,
        );
        fs.writeFileSync(
            project.projectEntryPointPath,
            fs.readFileSync(project.sampleEntryPointPath),
        );

        this.copyGradleFilesFromSample(project);
        this.copyPodfileFromSample(project, "ios");

        this.execGradlewCleanCommand(project);
        if (process.platform === "darwin") {
            this.execPodInstallCommand(project, "ios");
        }

        SmokeTestLogger.projectPatchingLog(
            `*** Copying ${project.testButtonFileForSample} into ${project.workspaceDirectory}`,
        );
        fs.copyFileSync(project.testButtonFileForSample, project.testButtonFileForWorkspace);
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

    private prepareReactNativeApplication(project: TestProject, version?: string) {
        const command = this.generateReactNativeInitCommand(project.appName, version);
        SmokeTestLogger.projectInstallLog(
            `*** Creating RN app via '${command}' in ${project.workspaceDirectory}...`,
        );
        utilities.execSync(
            command,
            { cwd: project.parentPathForWorkspace },
            vscodeManager.getSetupEnvironmentLogDir(),
        );

        SmokeTestLogger.projectPatchingLog(
            `*** Copying  ${project.sampleEntryPointPath} into ${project.projectEntryPointPath}...`,
        );
        fs.writeFileSync(
            project.projectEntryPointPath,
            fs.readFileSync(project.sampleEntryPointPath),
        );

        if (!fs.existsSync(project.vsCodeConfigPath)) {
            SmokeTestLogger.projectInstallLog(`*** Creating  ${project.vsCodeConfigPath}...`);
            fs.mkdirSync(project.vsCodeConfigPath);
        }

        this.copyDebuggingConfigurationsToProject(project);
        this.patchMetroConfig(project);
    }

    private prepareExpoApplication(project: TestProject, expoSdkMajorVersion?: string) {
        const useSpecificSdk = expoSdkMajorVersion ? `@sdk-${expoSdkMajorVersion}` : "";
        const initCommand = `echo -ne '\\n' | expo init -t tabs${useSpecificSdk} --name ${project.appName} ${project.appName}`;

        SmokeTestLogger.projectInstallLog(
            `*** Creating Expo app via '${initCommand}' in ${project.workspaceDirectory}...`,
        );
        utilities.execSync(
            initCommand,
            { cwd: project.parentPathForWorkspace },
            vscodeManager.getSetupEnvironmentLogDir(),
        );

        SmokeTestLogger.projectPatchingLog(
            `*** Copying  ${project.sampleEntryPointPath} into ${project.projectEntryPointPath}...`,
        );
        fs.writeFileSync(
            project.projectEntryPointPath,
            fs.readFileSync(project.sampleEntryPointPath),
        );

        if (!fs.existsSync(project.vsCodeConfigPath)) {
            SmokeTestLogger.projectInstallLog(`*** Creating  ${project.vsCodeConfigPath}...`);
            fs.mkdirSync(project.vsCodeConfigPath);
        }

        this.copyDebuggingConfigurationsToProject(project);

        this.patchMetroConfig(project);
        this.patchExpoSettingsFile(project);

        // We should install @expo/ngrok locally for Debug in Exponent (Tunnel)
        this.installPackagesForProject(project, true, "@expo/ngrok");
        const npmInstallCommand = `${utilities.npmCommand} install`;
        SmokeTestLogger.projectInstallLog(
            `*** Update node_modules for project in ${project.workspaceDirectory} via '${npmInstallCommand}' ...`,
        );
        utilities.execSync(
            npmInstallCommand,
            { cwd: project.workspaceDirectory },
            vscodeManager.getSetupEnvironmentLogDir(),
        );
    }

    private preparePureExpoApplication(
        project: TestProject,
        rnVersion?: string,
        expoVersion?: string,
    ) {
        this.prepareReactNativeApplication(project, rnVersion);
        this.addExpoDependencyToRNProject(project, expoVersion);
    }

    private prepareRNWApplication(project: TestProject, rnVersion?: string) {
        this.prepareReactNativeApplication(project, rnVersion);
        this.prepareReactNativeProjectForWindowsApplication(project);
    }

    private prepareMacOSApplication(project: TestProject, rnVersion?: string) {
        this.prepareReactNativeApplication(project, rnVersion);
        this.prepareReactNativeProjectForMacOSApplication(project);
    }

    private prepareMacOSHermesApplication(project: TestProject, rnVersion?: string) {
        this.prepareMacOSApplication(project, rnVersion);
        this.prepareReactNativeProjectForMacOSHermesApplication(project);
    }

    private prepareHermesApplication(project: TestProject, rnVersion?: string) {
        this.prepareReactNativeApplication(project, rnVersion);
        this.prepareReactNativeProjectForHermesTesting(project);
    }

    private addExpoDependencyToRNProject(project: TestProject, version?: string) {
        let expoPackage: string = version ? `expo@${version}` : "expo";

        this.installPackagesForProject(project, true, expoPackage);

        SmokeTestLogger.projectPatchingLog(
            `*** Copying  ${project.sampleEntryPointPath} into ${project.projectEntryPointPath}...`,
        );
        fs.writeFileSync(
            project.projectEntryPointPath,
            fs.readFileSync(project.sampleEntryPointPath),
        );
    }

    private copyGradleFilesFromSample(project: TestProject) {
        const appGradleBuildFilePath = project.gradleBuildFilePathForWorkspace;
        const resGradleBuildFilePath = project.gradleBuildFilePathForSample;

        SmokeTestLogger.projectPatchingLog(
            `*** Copying  ${resGradleBuildFilePath} into ${appGradleBuildFilePath}...`,
        );
        fs.writeFileSync(appGradleBuildFilePath, fs.readFileSync(resGradleBuildFilePath));
    }

    private copyPodfileFromSample(project: TestProject, platform: string) {
        const appPodfilePath = project.getPodfileByPlatformForWorkspace(platform);
        const resPodfilePath = project.getPodfileByPlatformForSample();

        if (resPodfilePath) {
            SmokeTestLogger.projectPatchingLog(
                `*** Copying ${resPodfilePath} into ${appPodfilePath}...`,
            );
            fs.writeFileSync(appPodfilePath, fs.readFileSync(resPodfilePath));
        }
    }

    private patchMetroConfig(project: TestProject) {
        const metroConfigPath = project.metroConfigPath;
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

    private removeProjectFolder(project: TestProject) {
        if (fs.existsSync(project.workspaceDirectory)) {
            SmokeTestLogger.info(`*** Deleting project directory: ${project.workspaceDirectory}`);
            rimraf.sync(project.workspaceDirectory);
        }
    }

    // Fix for https://github.com/expo/expo-cli/issues/951
    // TODO: Delete when bug will be fixed
    private patchExpoSettingsFile(project: TestProject) {
        const settingsJsonPath = project.expoSettingsPath;
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
        project: TestProject,
        packagesVersions: Map<string, string>,
        useCachedApplications: boolean,
    ): boolean {
        if (!useCachedApplications || !fs.existsSync(project.packageJsonPath)) {
            return false;
        }
        let useCachedApp = true;
        try {
            SmokeTestLogger.projectInstallLog(
                `Check for required packages versions for project by path '${project.workspaceDirectory}' :`,
            );
            const packageJsonData = JSON.parse(String(fs.readFileSync(project.packageJsonPath)));
            packagesVersions.forEach((version: string, packageName: string) => {
                if (
                    (!packageJsonData.dependencies[packageName] ||
                        !packageJsonData.dependencies[packageName].includes(version)) &&
                    (!packageJsonData.devDependencies[packageName] ||
                        !packageJsonData.devDependencies[packageName].includes(version))
                ) {
                    useCachedApp = false;
                    const actualVersion =
                        packageJsonData.dependencies[packageName] ||
                        packageJsonData.devDependencies[packageName];
                    SmokeTestLogger.error(
                        `${packageName}: ${version} ✘. Actual version: ${actualVersion}`,
                    );
                } else {
                    SmokeTestLogger.success(`${packageName}: ${version} ✓`);
                }
            });
        } catch (err) {
            SmokeTestLogger.warn(
                `There is error while reading 'package.json' file by path ${project.packageJsonPath}.\nContinue without using cache...`,
            );
            useCachedApp = false;
        }
        return useCachedApp;
    }

    private installPackagesForProject(
        project: TestProject,
        isDev: boolean = false,
        ...packages: string[]
    ): void {
        const command = `${utilities.npmCommand} install ${packages.join(" ")} ${
            isDev ? "--save-dev" : ""
        }`;
        SmokeTestLogger.projectInstallLog(
            `*** Adding ${packages.join(", ")} package${
                packages.length > 1 ? "s" : ""
            } to project in ${project.workspaceDirectory} via '${command}' ...`,
        );
        utilities.execSync(
            command,
            { cwd: project.workspaceDirectory },
            vscodeManager.getSetupEnvironmentLogDir(),
        );
    }

    private execGradlewCleanCommand(project: TestProject): void {
        const commandClean = path.join(project.getPlatformFolder("android"), "gradlew") + " clean";

        SmokeTestLogger.projectPatchingLog(
            `*** Executing '${commandClean}' command in path ${project.getPlatformFolder(
                "android",
            )}`,
        );
        utilities.execSync(
            commandClean,
            { cwd: project.getPlatformFolder("android") },
            vscodeManager.getSetupEnvironmentLogDir(),
        );
    }

    private execPodInstallCommand(project: TestProject, platform: string): void {
        const commandInstall = "LANG=en_US.UTF-8 pod install --verbose";

        SmokeTestLogger.projectPatchingLog(
            `*** Executing '${commandInstall}' command in path ${project.getPlatformFolder(
                platform,
            )}`,
        );
        utilities.execSync(
            commandInstall,
            { cwd: project.getPlatformFolder(platform) },
            vscodeManager.getSetupEnvironmentLogDir(),
        );
    }
}
