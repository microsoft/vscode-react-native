// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.

// eslint-disable-next-line @typescript-eslint/triple-slash-reference
/// <reference path="exponentHelper.d.ts" />

import * as path from "path";
import * as semver from "semver";
import * as vscode from "vscode";
import { sync as globSync } from "glob";
import * as nls from "vscode-nls";
import { stripJsonTrailingComma, getNodeModulesGlobalPath } from "../../common/utils";
import { Package, IPackageInformation } from "../../common/node/package";
import { ProjectVersionHelper } from "../../common/projectVersionHelper";
import { OutputChannelLogger } from "../log/OutputChannelLogger";
import { ErrorHelper } from "../../common/error/errorHelper";
import { PackageLoader, PackageConfig } from "../../common/packageLoader";
import { InternalErrorCode } from "../../common/error/internalErrorCode";
import { FileSystem } from "../../common/node/fileSystem";
import { SettingsHelper } from "../settingsHelper";
import * as XDL from "./xdlInterface";
import { logger } from "vscode-debugadapter";

nls.config({
    messageFormat: nls.MessageFormat.bundle,
    bundleFormat: nls.BundleFormat.standalone,
})();
const localize = nls.loadMessageBundle();

const APP_JSON = "app.json";
const EXP_JSON = "exp.json";

const EXPONENT_INDEX = "exponentIndex.js";
const DEFAULT_EXPONENT_INDEX = "index.js";
const DEFAULT_IOS_INDEX = "index.ios.js";
const DEFAULT_ANDROID_INDEX = "index.android.js";

const DBL_SLASHES = /\\/g;

const NGROK_PACKAGE = "@expo/ngrok";

export class ExponentHelper {
    private workspaceRootPath: string;
    private projectRootPath: string;
    private fs: FileSystem;
    private hasInitialized: boolean;
    private nodeModulesGlobalPathAddedToEnv: boolean;
    private logger: OutputChannelLogger = OutputChannelLogger.getMainChannel();

    public constructor(
        workspaceRootPath: string,
        projectRootPath: string,
        fs: FileSystem = new FileSystem(),
    ) {
        this.workspaceRootPath = workspaceRootPath;
        this.projectRootPath = projectRootPath;
        this.fs = fs;
        this.hasInitialized = false;
        // Constructor is slim by design. This is to add as less computation as possible
        // to the initialization of the extension. If a public method is added, make sure
        // to call this.lazilyInitialize() at the beginning of the code to be sure all variables
        // are correctly initialized.
        this.nodeModulesGlobalPathAddedToEnv = false;
    }

    public async preloadExponentDependency(): Promise<[typeof xdl, typeof metroConfig]> {
        this.logger.info(
            localize(
                "MakingSureYourProjectUsesCorrectExponentDependencies",
                "Making sure your project uses the correct dependencies for Expo. This may take a while...",
            ),
        );
        return Promise.all([XDL.getXDLPackage(), XDL.getMetroConfigPackage()]);
    }

    public async configureExponentEnvironment(): Promise<void> {
        await this.lazilyInitialize();
        this.logger.logStream(
            localize("CheckingIfThisIsExpoApp", "Checking if this is an Expo app."),
        );
        const isExpo = await this.isExpoManagedApp(true);
        if (!isExpo) {
            if (!(await this.appHasExpoInstalled())) {
                // Expo requires expo package to be installed inside RN application in order to be able to run it
                // https://github.com/expo/expo-cli/issues/255#issuecomment-453214632
                this.logger.logStream("\n");
                this.logger.logStream(
                    localize(
                        "ExpoPackageIsNotInstalled",
                        '[Warning] Please make sure that expo package is installed locally for your project, otherwise further errors may occur. Please, run "npm install expo --save-dev" inside your project to install it.',
                    ),
                );
                this.logger.logStream("\n");
            }
        }
        this.logger.logStream(".\n");
        await this.patchAppJson(isExpo);
    }

    /**
     * Returns the current user. If there is none, asks user for username and password and logins to exponent servers.
     */
    public async loginToExponent(
        promptForInformation: (message: string, password: boolean) => Promise<string>,
        showMessage: (message: string) => Promise<string>,
    ): Promise<XDL.IUser> {
        await this.lazilyInitialize();
        let user = await XDL.currentUser();
        if (!user) {
            await showMessage(
                localize(
                    "YouNeedToLoginToExpo",
                    "You need to login to Expo. Please provide your Expo account username and password in the input boxes after closing this window. If you don't have an account, please go to https://expo.io to create one.",
                ),
            );
            const username = await promptForInformation(
                localize("ExpoUsername", "Expo username"),
                false,
            );
            const password = await promptForInformation(
                localize("ExpoPassword", "Expo password"),
                true,
            );
            user = await XDL.login(username, password);
        }
        return user;
    }

    public async getExpPackagerOptions(projectRoot: string): Promise<ExpMetroConfig> {
        await this.lazilyInitialize();
        const options = await this.getFromExpConfig<any>("packagerOpts").then(opts => opts || {});
        const metroConfig = await this.getArgumentsFromExpoMetroConfig(projectRoot);
        return { ...options, ...metroConfig };
    }

    public async appHasExpoInstalled(): Promise<boolean> {
        const packageJson = await this.getAppPackageInformation();
        if (packageJson.dependencies && packageJson.dependencies.expo) {
            this.logger.debug("'expo' package is found in 'dependencies' section of package.json");
            return true;
        } else if (packageJson.devDependencies && packageJson.devDependencies.expo) {
            this.logger.debug(
                "'expo' package is found in 'devDependencies' section of package.json",
            );
            return true;
        }
        return false;
    }

    public async isExpoManagedApp(showProgress: boolean = false): Promise<boolean> {
        if (showProgress) {
            this.logger.logStream("...");
        }

        try {
            const expoInstalled = await this.appHasExpoInstalled();
            if (!expoInstalled) return false;

            const isBareWorkflowProject = await this.isBareWorkflowProject();
            if (showProgress) this.logger.logStream(".");
            return !isBareWorkflowProject;
        } catch (e) {
            this.logger.error(e.message, e, e.stack);
            if (showProgress) {
                this.logger.logStream(".");
            }
            // Not in a react-native project
            return false;
        }
    }

    public async findOrInstallNgrokGlobally(): Promise<void> {
        let ngrokInstalled: boolean;
        try {
            await this.addNodeModulesPathToEnvIfNotPresent();
            ngrokInstalled = await XDL.isNgrokInstalled(this.projectRootPath);
        } catch (e) {
            ngrokInstalled = false;
        }
        if (!ngrokInstalled) {
            const ngrokVersion = SettingsHelper.getExpoDependencyVersion("@expo/ngrok");
            const ngrokPackageConfig = new PackageConfig(NGROK_PACKAGE, ngrokVersion);

            const outputMessage = localize(
                "ExpoInstallNgrokGlobally",
                'It seems that "{0}" package isn\'t installed globally. This package is required to use Expo tunnels, would you like to install it globally?',
                ngrokPackageConfig.getStringForInstall(),
            );
            const installButton = localize("InstallNgrokGloballyButtonOK", "Install");
            const cancelButton = localize("InstallNgrokGloballyButtonCancel", "Cancel");

            const selectedItem = await vscode.window.showWarningMessage(
                outputMessage,
                installButton,
                cancelButton,
            );
            if (selectedItem === installButton) {
                await PackageLoader.getInstance().installGlobalPackage(
                    ngrokPackageConfig,
                    this.projectRootPath,
                );
                this.logger.info(
                    localize(
                        "NgrokInstalledGlobally",
                        '"{0}" package has been successfully installed globally.',
                        ngrokPackageConfig.getStringForInstall(),
                    ),
                );
            } else {
                throw ErrorHelper.getInternalError(
                    InternalErrorCode.NgrokIsNotInstalledGlobally,
                    ngrokPackageConfig.getVersion(true),
                );
            }
        }
    }

    public removeNodeModulesPathFromEnvIfWasSet(): void {
        if (this.nodeModulesGlobalPathAddedToEnv) {
            delete process.env.NODE_MODULES;
            this.nodeModulesGlobalPathAddedToEnv = false;
        }
    }

    public async addNodeModulesPathToEnvIfNotPresent(): Promise<void> {
        if (!process.env.NODE_MODULES) {
            process.env.NODE_MODULES = await getNodeModulesGlobalPath();
            this.nodeModulesGlobalPathAddedToEnv = true;
        }
    }

    private async isBareWorkflowProject(): Promise<boolean> {
        const packageJson = await this.getAppPackageInformation();

        if (packageJson.dependencies && packageJson.dependencies.expokit) {
            return false;
        }
        if (packageJson.devDependencies && packageJson.devDependencies.expokit) {
            return false;
        }

        const xcodeprojFiles = globSync("ios/**/*.xcodeproj", {
            absolute: true,
            cwd: this.projectRootPath,
        });
        if (xcodeprojFiles.length) {
            return true;
        }
        const gradleFiles = globSync("android/**/*.gradle", {
            absolute: true,
            cwd: this.projectRootPath,
        });
        if (gradleFiles.length) {
            return true;
        }

        return false;
    }

    private async getArgumentsFromExpoMetroConfig(projectRoot: string): Promise<ExpMetroConfig> {
        const config = await XDL.getMetroConfig(projectRoot);
        return { sourceExts: config.resolver.sourceExts };
    }

    /**
     * Path to a given file inside the .vscode directory
     */
    private dotvscodePath(filename: string, isAbsolute: boolean): string {
        let paths = [".vscode", filename];
        if (isAbsolute) {
            paths = [this.workspaceRootPath].concat(...paths);
        }
        return path.join(...paths);
    }

    private async createExpoEntry(name: string): Promise<void> {
        await this.lazilyInitialize();
        const entryPoint = await this.detectEntry();
        const content = this.generateFileContent(name, entryPoint);
        return await this.fs.writeFile(this.dotvscodePath(EXPONENT_INDEX, true), content);
    }

    private async detectEntry(): Promise<string> {
        await this.lazilyInitialize();
        const [expo, ios] = await Promise.all([
            this.fs.exists(this.pathToFileInWorkspace(DEFAULT_EXPONENT_INDEX)),
            this.fs.exists(this.pathToFileInWorkspace(DEFAULT_IOS_INDEX)),
            this.fs.exists(this.pathToFileInWorkspace(DEFAULT_ANDROID_INDEX)),
        ]);
        return expo
            ? this.pathToFileInWorkspace(DEFAULT_EXPONENT_INDEX)
            : ios
            ? this.pathToFileInWorkspace(DEFAULT_IOS_INDEX)
            : this.pathToFileInWorkspace(DEFAULT_ANDROID_INDEX);
    }

    private generateFileContent(name: string, entryPoint: string): string {
        return `// This file is automatically generated by VS Code
// Please do not modify it manually. All changes will be lost.
var React = require('${this.pathToFileInWorkspace("/node_modules/react")}');
var { Component } = React;
var ReactNative = require('${this.pathToFileInWorkspace("/node_modules/react-native")}');
var { AppRegistry } = ReactNative;
AppRegistry.registerRunnable('main', function(appParameters) {
    AppRegistry.runApplication('${name}', appParameters);
});
require('${entryPoint}');`;
    }

    private async patchAppJson(isExpo: boolean = true): Promise<void> {
        let appJson: AppJson;
        try {
            logger.log("Reading app.json file.");
            appJson = await this.readAppJson();
        } catch {
            // if app.json doesn't exist but it's ok, we will create it
            logger.log("Not get existing app.json file. Create new one.");
            appJson = <AppJson>{};
        }
        const packageName = await this.getPackageName();

        const expoConfig = <ExpConfig>(appJson.expo || {});
        if (!expoConfig.name || !expoConfig.slug) {
            expoConfig.slug = expoConfig.slug || appJson.name || packageName.replace(" ", "-");
            expoConfig.name = expoConfig.name || appJson.name || packageName;
            appJson.expo = expoConfig;
        }

        if (!appJson.name) {
            appJson.name = packageName;
        }

        if (!appJson.expo.sdkVersion) {
            const sdkVersion = await this.exponentSdk(true);
            appJson.expo.sdkVersion = sdkVersion;
        }

        if (!isExpo) {
            // entryPoint must be relative
            // https://docs.expo.io/versions/latest/workflow/configuration/#entrypoint
            appJson.expo.entryPoint = this.dotvscodePath(EXPONENT_INDEX, false);
        }

        appJson = appJson ? await this.writeAppJson(appJson) : appJson;

        if (!isExpo) {
            await this.createExpoEntry(appJson.expo.name);
        }
    }

    /**
     * Exponent sdk version that maps to the current react-native version
     * If react native version is not supported it returns null.
     */
    private async exponentSdk(showProgress: boolean = false): Promise<string> {
        if (showProgress) {
            this.logger.logStream("...");
        }

        const versions = await ProjectVersionHelper.getReactNativeVersions(this.projectRootPath);
        if (showProgress) {
            this.logger.logStream(".");
        }
        const sdkVersion = await this.mapFacebookReactNativeVersionToExpoVersion(
            versions.reactNativeVersion,
        );
        if (!sdkVersion) {
            const supportedVersions = await this.getFacebookReactNativeVersions();
            throw ErrorHelper.getInternalError(
                InternalErrorCode.RNVersionNotSupportedByExponent,
                supportedVersions.join(", "),
            );
        }
        return sdkVersion;
    }

    private async getFacebookReactNativeVersions(): Promise<string[]> {
        const sdkVersions = await XDL.getExpoSdkVersions();
        const facebookReactNativeVersions = new Set(
            Object.values(sdkVersions)
                .map(data => data.facebookReactNativeVersion)
                .filter(version => version),
        );
        return Array.from(facebookReactNativeVersions);
    }

    private async mapFacebookReactNativeVersionToExpoVersion(
        outerFacebookReactNativeVersion: string,
    ): Promise<string | null> {
        if (!semver.valid(outerFacebookReactNativeVersion)) {
            throw new Error(
                `${outerFacebookReactNativeVersion} is not a valid version. It must be in the form of x.y.z`,
            );
        }

        const sdkVersions = await XDL.getReleasedExpoSdkVersions();
        let currentSdkVersion: string | null = null;
        for (const [version, { facebookReactNativeVersion }] of Object.entries(sdkVersions)) {
            if (
                semver.major(outerFacebookReactNativeVersion) ===
                    semver.major(facebookReactNativeVersion) &&
                semver.minor(outerFacebookReactNativeVersion) ===
                    semver.minor(facebookReactNativeVersion) &&
                (!currentSdkVersion || semver.gt(version, currentSdkVersion))
            ) {
                currentSdkVersion = version;
            }
        }
        return currentSdkVersion;
    }

    /**
     * Name specified on user's package.json
     */
    private getPackageName(): Promise<string> {
        return new Package(this.projectRootPath, { fileSystem: this.fs }).name();
    }

    private async getExpConfig(): Promise<ExpConfig> {
        try {
            return this.readExpJson();
        } catch (err) {
            if (err.code === "ENOENT") {
                const appJson = await this.readAppJson();
                return appJson.expo || {};
            }
            throw err;
        }
    }

    private async getFromExpConfig<T>(key: string): Promise<T> {
        const config = await this.getExpConfig();
        return config[key];
    }

    /**
     * Returns the specified setting from exp.json if it exists
     */
    private async readExpJson(): Promise<ExpConfig> {
        const expJsonPath = this.pathToFileInWorkspace(EXP_JSON);
        return this.fs.readFile(expJsonPath).then(content => {
            return stripJsonTrailingComma(content.toString());
        });
    }

    private async readAppJson(): Promise<AppJson> {
        const appJsonPath = this.pathToFileInWorkspace(APP_JSON);
        logger.log(`Getting app.json path: ${appJsonPath}`);
        return this.fs.readFile(appJsonPath).then(content => {
            logger.log(`Reading app.json file successfully. Content:${content.toString()}`);
            return stripJsonTrailingComma(content.toString());
        });
    }

    private async writeAppJson(config: AppJson): Promise<AppJson> {
        const appJsonPath = this.pathToFileInWorkspace(APP_JSON);
        await this.fs.writeFile(appJsonPath, JSON.stringify(config, null, 2));
        return config;
    }

    private getAppPackageInformation(): Promise<IPackageInformation> {
        return new Package(this.projectRootPath, { fileSystem: this.fs }).parsePackageInformation();
    }

    /**
     * Path to a given file from the workspace root
     */
    private pathToFileInWorkspace(filename: string): string {
        return path.join(this.projectRootPath, filename).replace(DBL_SLASHES, "/");
    }

    /**
     * Works as a constructor but only initializes when it's actually needed.
     */
    private async lazilyInitialize(): Promise<void> {
        if (!this.hasInitialized) {
            this.hasInitialized = true;
            await this.preloadExponentDependency();
            void XDL.configReactNativeVersionWarnings();
            void XDL.attachLoggerStream(this.projectRootPath, {
                stream: {
                    write: (chunk: any) => {
                        if (chunk.level <= 30) {
                            this.logger.logStream(chunk.msg);
                        } else if (chunk.level === 40) {
                            this.logger.warning(chunk.msg);
                        } else {
                            this.logger.error(chunk.msg);
                        }
                    },
                },
                type: "raw",
            });
        }
    }
}
