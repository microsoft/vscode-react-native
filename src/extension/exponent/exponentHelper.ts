// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.

/// <reference path="exponentHelper.d.ts" />

import * as path from "path";
import * as semver from "semver";
import * as vscode from "vscode";
import * as XDL from "./xdlInterface";
import { Package, IPackageInformation } from "../../common/node/package";
import { ProjectVersionHelper } from "../../common/projectVersionHelper";
import { OutputChannelLogger } from "../log/OutputChannelLogger";
import stripJSONComments = require("strip-json-comments");
import * as nls from "vscode-nls";
import { ErrorHelper } from "../../common/error/errorHelper";
import { getNodeModulesGlobalPath } from "../../common/utils";
import PackageLoader from "../../common/packageLoader";
import { InternalErrorCode } from "../../common/error/internalErrorCode";
import { FileSystem } from "../../common/node/fileSystem";
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
        // to call this.lazilyInitialize() at the begining of the code to be sure all variables
        // are correctly initialized.
        this.nodeModulesGlobalPathAddedToEnv = false;
    }

    public configureExponentEnvironment(): Promise<void> {
        this.lazilyInitialize();
        this.logger.info(
            localize(
                "MakingSureYourProjectUsesCorrectExponentDependencies",
                "Making sure your project uses the correct dependencies for Expo. This may take a while...",
            ),
        );
        this.logger.logStream(localize("CheckingIfThisIsExpoApp", "Checking if this is Expo app."));
        let isExpo: boolean;
        return this.isExpoApp(true)
            .then(result => {
                isExpo = result;
                if (!isExpo) {
                    return this.appHasExpoInstalled().then(expoInstalled => {
                        if (!expoInstalled) {
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
                    });
                }
                return;
            })
            .then(() => {
                this.logger.logStream(".\n");
                return this.patchAppJson(isExpo);
            });
    }

    /**
     * Returns the current user. If there is none, asks user for username and password and logins to exponent servers.
     */
    public loginToExponent(
        promptForInformation: (message: string, password: boolean) => Promise<string>,
        showMessage: (message: string) => Promise<string>,
    ): Promise<XDL.IUser> {
        this.lazilyInitialize();
        return XDL.currentUser()
            .then(user => {
                if (!user) {
                    let username = "";
                    return showMessage(
                        localize(
                            "YouNeedToLoginToExpo",
                            "You need to login to Expo. Please provide your Expo account username and password in the input boxes after closing this window. If you don't have an account, please go to https://expo.io to create one.",
                        ),
                    )
                        .then(() =>
                            promptForInformation(localize("ExpoUsername", "Expo username"), false),
                        )
                        .then((name: string) => {
                            username = name;
                            return promptForInformation(
                                localize("ExpoPassword", "Expo password"),
                                true,
                            );
                        })
                        .then((password: string) => XDL.login(username, password));
                }
                return user;
            })
            .catch(error => {
                return Promise.reject<XDL.IUser>(error);
            });
    }

    public async getExpPackagerOptions(projectRoot: string): Promise<ExpMetroConfig> {
        this.lazilyInitialize();
        const options = await this.getFromExpConfig<any>("packagerOpts").then(opts => opts || {});
        const metroConfig = await this.getArgumentsFromExpoMetroConfig(projectRoot);
        return { ...options, ...metroConfig };
    }

    public appHasExpoInstalled(): Promise<boolean> {
        return this.getAppPackageInformation().then((packageJson: IPackageInformation) => {
            if (packageJson.dependencies && packageJson.dependencies.expo) {
                this.logger.debug(
                    "'expo' package is found in 'dependencies' section of package.json",
                );
                return true;
            } else if (packageJson.devDependencies && packageJson.devDependencies.expo) {
                this.logger.debug(
                    "'expo' package is found in 'devDependencies' section of package.json",
                );
                return true;
            }
            return false;
        });
    }

    public appHasExpoRNSDKInstalled(): Promise<boolean> {
        return this.getAppPackageInformation().then((packageJson: IPackageInformation) => {
            const reactNativeValue: string | undefined =
                packageJson.dependencies && packageJson.dependencies["react-native"];
            if (reactNativeValue) {
                this.logger.debug(
                    `'react-native' package with value '${reactNativeValue}' is found in 'dependencies' section of package.json`,
                );
                if (
                    reactNativeValue.startsWith("https://github.com/expo/react-native/archive/sdk")
                ) {
                    return true;
                }
            }
            return false;
        });
    }

    public isExpoApp(showProgress: boolean = false): Promise<boolean> {
        if (showProgress) {
            this.logger.logStream("...");
        }

        return Promise.all([this.appHasExpoInstalled(), this.appHasExpoRNSDKInstalled()])
            .then(([expoInstalled, expoRNSDKInstalled]) => {
                if (showProgress) this.logger.logStream(".");
                return expoInstalled && expoRNSDKInstalled;
            })
            .catch(e => {
                this.logger.error(e.message, e, e.stack);
                if (showProgress) {
                    this.logger.logStream(".");
                }
                // Not in a react-native project
                return false;
            });
    }

    public findOrInstallNgrokGlobally(): Promise<void> {
        return this.addNodeModulesPathToEnvIfNotPresent()
            .then(() => XDL.isNgrokInstalled(this.projectRootPath))
            .catch(() => false)
            .then(ngrokInstalled => {
                if (!ngrokInstalled) {
                    const outputMessage = localize(
                        "ExpoInstallNgrokGlobally",
                        'It seems that "@expo/ngrok" package isn\'t installed globally. This package is required to use Expo tunnels, would you like to install it globally?',
                    );
                    const installButton = localize("InstallNgrokGloballyButtonOK", "Install");
                    const cancelButton = localize("InstallNgrokGloballyButtonCancel", "Cancel");

                    return vscode.window
                        .showWarningMessage(outputMessage, installButton, cancelButton)
                        .then(selectedItem => {
                            if (selectedItem === installButton) {
                                return PackageLoader.getInstance()
                                    .installGlobalPackage(NGROK_PACKAGE, this.projectRootPath)
                                    .then(() => {
                                        this.logger.info(
                                            localize(
                                                "NgrokInstalledGlobally",
                                                '"@expo/ngrok" package has been successfully installed globally.',
                                            ),
                                        );
                                    });
                            }
                            throw ErrorHelper.getInternalError(
                                InternalErrorCode.NgrokIsNotInstalledGlobally,
                            );
                        });
                }
                return void 0;
            });
    }

    public removeNodeModulesPathFromEnvIfWasSet(): void {
        if (this.nodeModulesGlobalPathAddedToEnv) {
            delete process.env["NODE_MODULES"];
            this.nodeModulesGlobalPathAddedToEnv = false;
        }
    }

    public addNodeModulesPathToEnvIfNotPresent(): Promise<void> {
        if (!process.env["NODE_MODULES"]) {
            return getNodeModulesGlobalPath().then(nodeModulesGlobalPath => {
                process.env["NODE_MODULES"] = nodeModulesGlobalPath;
                this.nodeModulesGlobalPathAddedToEnv = true;
            });
        }
        return Promise.resolve();
    }

    private async getArgumentsFromExpoMetroConfig(projectRoot: string): Promise<ExpMetroConfig> {
        return XDL.getMetroConfig(projectRoot).then(config => {
            return { sourceExts: config.resolver.sourceExts };
        });
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

    private createExpoEntry(name: string): Promise<void> {
        this.lazilyInitialize();
        return this.detectEntry().then((entryPoint: string) => {
            const content = this.generateFileContent(name, entryPoint);
            return this.fs.writeFile(this.dotvscodePath(EXPONENT_INDEX, true), content);
        });
    }

    private detectEntry(): Promise<string> {
        this.lazilyInitialize();
        return Promise.all([
            this.fs.exists(this.pathToFileInWorkspace(DEFAULT_EXPONENT_INDEX)),
            this.fs.exists(this.pathToFileInWorkspace(DEFAULT_IOS_INDEX)),
            this.fs.exists(this.pathToFileInWorkspace(DEFAULT_ANDROID_INDEX)),
        ]).then(([expo, ios]) => {
            return expo
                ? this.pathToFileInWorkspace(DEFAULT_EXPONENT_INDEX)
                : ios
                ? this.pathToFileInWorkspace(DEFAULT_IOS_INDEX)
                : this.pathToFileInWorkspace(DEFAULT_ANDROID_INDEX);
        });
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
var entryPoint = require('${entryPoint}');`;
    }

    private patchAppJson(isExpo: boolean = true): Promise<void> {
        return this.readAppJson()
            .catch(() => {
                // if app.json doesn't exist but it's ok, we will create it
                return {};
            })
            .then((config: AppJson) => {
                let expoConfig = <ExpConfig>(config.expo || {});
                if (!expoConfig.name || !expoConfig.slug) {
                    return this.getPackageName().then((name: string) => {
                        expoConfig.slug = expoConfig.slug || config.name || name.replace(" ", "-");
                        expoConfig.name = expoConfig.name || config.name || name;
                        config.expo = expoConfig;
                        return config;
                    });
                }

                return config;
            })
            .then((config: AppJson) => {
                if (!config.name) {
                    return this.getPackageName().then((name: string) => {
                        config.name = name;
                        return config;
                    });
                }

                return config;
            })
            .then((config: AppJson) => {
                if (!config.expo.sdkVersion) {
                    return this.exponentSdk(true).then(sdkVersion => {
                        config.expo.sdkVersion = sdkVersion;
                        return config;
                    });
                }

                return config;
            })
            .then((config: AppJson) => {
                if (!isExpo) {
                    // entryPoint must be relative
                    // https://docs.expo.io/versions/latest/workflow/configuration/#entrypoint
                    config.expo.entryPoint = this.dotvscodePath(EXPONENT_INDEX, false);
                }

                return config;
            })
            .then((config: AppJson) => {
                return config ? this.writeAppJson(config) : config;
            })
            .then((config: AppJson) => {
                return isExpo ? Promise.resolve() : this.createExpoEntry(config.expo.name);
            });
    }

    /**
     * Exponent sdk version that maps to the current react-native version
     * If react native version is not supported it returns null.
     */
    private exponentSdk(showProgress: boolean = false): Promise<string> {
        if (showProgress) {
            this.logger.logStream("...");
        }

        return ProjectVersionHelper.getReactNativeVersions(this.projectRootPath).then(versions => {
            if (showProgress) this.logger.logStream(".");
            return this.mapFacebookReactNativeVersionToExpoVersion(
                versions.reactNativeVersion,
            ).then(sdkVersion => {
                if (!sdkVersion) {
                    return this.getFacebookReactNativeVersions().then(versions => {
                        return Promise.reject<string>(
                            ErrorHelper.getInternalError(
                                InternalErrorCode.RNVersionNotSupportedByExponent,
                                versions.join(", "),
                            ),
                        );
                    });
                }
                return sdkVersion;
            });
        });
    }

    private getFacebookReactNativeVersions(): Promise<string[]> {
        return XDL.getExpoSdkVersions().then(sdkVersions => {
            const facebookReactNativeVersions = new Set(
                Object.values(sdkVersions)
                    .map(data => data.facebookReactNativeVersion)
                    .filter(version => version),
            );
            return Array.from(facebookReactNativeVersions);
        });
    }

    private mapFacebookReactNativeVersionToExpoVersion(
        outerFacebookReactNativeVersion: string,
    ): Promise<string | null> {
        if (!semver.valid(outerFacebookReactNativeVersion)) {
            return Promise.reject(
                new Error(
                    `${outerFacebookReactNativeVersion} is not a valid version. It must be in the form of x.y.z`,
                ),
            );
        }

        return XDL.getReleasedExpoSdkVersions().then(sdkVersions => {
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
        });
    }

    /**
     * Name specified on user's package.json
     */
    private getPackageName(): Promise<string> {
        return new Package(this.projectRootPath, { fileSystem: this.fs }).name();
    }

    private getExpConfig(): Promise<ExpConfig> {
        return this.readExpJson().catch(err => {
            if (err.code === "ENOENT") {
                return this.readAppJson().then((config: AppJson) => {
                    return config.expo || {};
                });
            }

            return err;
        });
    }

    private getFromExpConfig<T>(key: string): Promise<T> {
        return this.getExpConfig().then((config: ExpConfig) => config[key]);
    }

    /**
     * Returns the specified setting from exp.json if it exists
     */
    private readExpJson(): Promise<ExpConfig> {
        const expJsonPath = this.pathToFileInWorkspace(EXP_JSON);
        return this.fs.readFile(expJsonPath).then(content => {
            return JSON.parse(stripJSONComments(content.toString()));
        });
    }

    private readAppJson(): Promise<AppJson> {
        const appJsonPath = this.pathToFileInWorkspace(APP_JSON);
        return this.fs.readFile(appJsonPath).then(content => {
            return JSON.parse(stripJSONComments(content.toString()));
        });
    }

    private writeAppJson(config: AppJson): Promise<AppJson> {
        const appJsonPath = this.pathToFileInWorkspace(APP_JSON);
        return this.fs.writeFile(appJsonPath, JSON.stringify(config, null, 2)).then(() => config);
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
     * Works as a constructor but only initiliazes when it's actually needed.
     */
    private lazilyInitialize(): void {
        if (!this.hasInitialized) {
            this.hasInitialized = true;

            XDL.configReactNativeVersionWarnings();
            XDL.attachLoggerStream(this.projectRootPath, {
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
