// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.

import * as path from "path";
import * as semver from "semver";

import { ChildProcess } from "../../common/node/childProcess";
import { CommandExecutor } from "../../common/commandExecutor";
import { GeneralMobilePlatform, MobilePlatformDeps, TargetType } from "../generalMobilePlatform";
import { IIOSRunOptions, PlatformType } from "../launchArgs";
import { PlistBuddy } from "./plistBuddy";
import { IOSDebugModeManager } from "./iOSDebugModeManager";
import { OutputVerifier, PatternToFailure } from "../../common/outputVerifier";
import { TelemetryHelper } from "../../common/telemetryHelper";
import { InternalErrorCode } from "../../common/error/internalErrorCode";
import * as nls from "vscode-nls";
import { AppLauncher } from "../appLauncher";
import { IiOSSimulator, IOSSimulatorManager } from "./iOSSimulatorManager";
nls.config({
    messageFormat: nls.MessageFormat.bundle,
    bundleFormat: nls.BundleFormat.standalone,
})();
const localize = nls.loadMessageBundle();

export class IOSPlatform extends GeneralMobilePlatform {
    public static DEFAULT_IOS_PROJECT_RELATIVE_PATH = "ios";

    private plistBuddy = new PlistBuddy(undefined, this.nodeModulesRoot);
    private targetType: TargetType = "simulator";
    private iosProjectRoot: string;
    private iosDebugModeManager: IOSDebugModeManager;
    private simulatorManager: IOSSimulatorManager;

    private defaultConfiguration: string = "Debug";
    private configurationArgumentName: string = "--configuration";

    // We should add the common iOS build/run errors we find to this list
    private static RUN_IOS_FAILURE_PATTERNS: PatternToFailure[] = [
        {
            pattern: "No devices are booted",
            errorCode: InternalErrorCode.IOSSimulatorNotLaunchable,
        },
        {
            pattern: "FBSOpenApplicationErrorDomain",
            errorCode: InternalErrorCode.IOSSimulatorNotLaunchable,
        },
        {
            pattern: "ios-deploy",
            errorCode: InternalErrorCode.IOSDeployNotFound,
        },
    ];

    private static readonly RUN_IOS_SUCCESS_PATTERNS = ["BUILD SUCCEEDED"];

    public showDevMenu(appLauncher: AppLauncher): Promise<void> {
        const worker = appLauncher.getAppWorker();
        if (worker) {
            worker.showDevMenuCommand();
        }

        return Promise.resolve();
    }

    public reloadApp(appLauncher: AppLauncher): Promise<void> {
        const worker = appLauncher.getAppWorker();
        if (worker) {
            worker.reloadAppCommand();
        }
        return Promise.resolve();
    }

    constructor(
        protected runOptions: IIOSRunOptions,
        platformDeps: MobilePlatformDeps = {},
        nodeModulesRoot: string,
    ) {
        super(runOptions, platformDeps, nodeModulesRoot);

        this.simulatorManager = new IOSSimulatorManager();
        this.runOptions.configuration = this.getConfiguration();

        if (this.runOptions.iosRelativeProjectPath) {
            // Deprecated option
            this.logger.warning(
                localize(
                    "iosRelativeProjectPathOptionIsDeprecatedUseRunArgumentsInstead",
                    "'iosRelativeProjectPath' option is deprecated. Please use 'runArguments' instead.",
                ),
            );
        }

        const iosProjectFolderPath = IOSPlatform.getOptFromRunArgs(
            this.runArguments,
            "--project-path",
            false,
        );
        this.iosProjectRoot = path.join(
            this.projectPath,
            iosProjectFolderPath ||
                this.runOptions.iosRelativeProjectPath ||
                IOSPlatform.DEFAULT_IOS_PROJECT_RELATIVE_PATH,
        );
        const schemeFromArgs = IOSPlatform.getOptFromRunArgs(this.runArguments, "--scheme", false);
        this.iosDebugModeManager = new IOSDebugModeManager(
            this.iosProjectRoot,
            this.projectPath,
            nodeModulesRoot,
            schemeFromArgs ? schemeFromArgs : this.runOptions.scheme,
        );

        if (this.runArguments && this.runArguments.length > 0) {
            this.targetType =
                this.runArguments.indexOf(`--${IOSPlatform.deviceString}`) >= 0
                    ? IOSPlatform.deviceString
                    : IOSPlatform.simulatorString;
            return;
        }

        if (
            this.runOptions.target &&
            this.runOptions.target !== IOSPlatform.simulatorString &&
            this.runOptions.target !== IOSPlatform.deviceString
        ) {
            this.targetType = IOSPlatform.simulatorString;
            return;
        }

        this.targetType = this.runOptions.target || IOSPlatform.simulatorString;
    }

    public resolveVirtualDevice(target: string): Promise<IiOSSimulator | null> {
        if (target === "simulator") {
            return this.simulatorManager
                .startSelection()
                .then((simulatorName: string | undefined) => {
                    if (simulatorName) {
                        const simulator = this.simulatorManager.findSimulator(simulatorName);
                        if (simulator) {
                            GeneralMobilePlatform.removeRunArgument(
                                this.runArguments,
                                "--simulator",
                                true,
                            );
                            GeneralMobilePlatform.setRunArgument(
                                this.runArguments,
                                "--udid",
                                simulator.id,
                            );
                        }
                        return simulator;
                    } else {
                        return null;
                    }
                });
        } else if (!target.includes("device")) {
            return this.simulatorManager.collectSimulators().then(simulators => {
                let simulator = this.simulatorManager.getSimulatorById(target, simulators);
                if (simulator) {
                    GeneralMobilePlatform.removeRunArgument(
                        this.runArguments,
                        "--simulator",
                        false,
                    );
                    GeneralMobilePlatform.setRunArgument(this.runArguments, "--udid", simulator.id);
                }
                return null;
            });
        } else {
            return Promise.resolve(null);
        }
    }

    public runApp(): Promise<void> {
        let extProps = {
            platform: {
                value: PlatformType.iOS,
                isPii: false,
            },
        };

        extProps = TelemetryHelper.addPlatformPropertiesToTelemetryProperties(
            this.runOptions,
            this.runOptions.reactNativeVersions,
            extProps,
        );

        return TelemetryHelper.generate("iOSPlatform.runApp", extProps, async () => {
            // Compile, deploy, and launch the app on either a simulator or a device
            const env = GeneralMobilePlatform.getEnvArgument(
                process.env,
                this.runOptions.env,
                this.runOptions.envFile,
            );

            if (
                !semver.valid(
                    this.runOptions.reactNativeVersions.reactNativeVersion,
                ) /*Custom RN implementations should support this flag*/ ||
                semver.gte(
                    this.runOptions.reactNativeVersions.reactNativeVersion,
                    IOSPlatform.NO_PACKAGER_VERSION,
                )
            ) {
                this.runArguments.push("--no-packager");
            }
            // Since @react-native-community/cli@2.1.0 build output are hidden by default
            // we are using `--verbose` to show it as it contains `BUILD SUCCESSFUL` and other patterns
            if (semver.gte(this.runOptions.reactNativeVersions.reactNativeVersion, "0.60.0")) {
                this.runArguments.push("--verbose");
            }
            const runIosSpawn = await new CommandExecutor(
                this.nodeModulesRoot,
                this.projectPath,
                this.logger,
            ).spawnReactCommand("run-ios", this.runArguments, { env });
            return new OutputVerifier(
                () =>
                    this.generateSuccessPatterns(
                        this.runOptions.reactNativeVersions.reactNativeVersion,
                    ),
                () => Promise.resolve(IOSPlatform.RUN_IOS_FAILURE_PATTERNS),
                PlatformType.iOS,
            ).process(runIosSpawn);
        });
    }

    public enableJSDebuggingMode(): Promise<void> {
        // Configure the app for debugging
        if (this.targetType === IOSPlatform.deviceString) {
            // Note that currently we cannot automatically switch the device into debug mode.
            this.logger.info(
                "Application is running on a device, please shake device and select 'Debug JS Remotely' to enable debugging.",
            );
            return Promise.resolve();
        }

        // Wait until the configuration file exists, and check to see if debugging is enabled
        return Promise.all<boolean | string>([
            this.iosDebugModeManager.getSimulatorRemoteDebuggingSetting(
                this.runOptions.configuration,
                this.runOptions.productName,
            ),
            this.getBundleId(),
        ]).then(([debugModeEnabled, bundleId]) => {
            if (debugModeEnabled) {
                return Promise.resolve();
            }

            // Debugging must still be enabled
            // We enable debugging by writing to a plist file that backs a NSUserDefaults object,
            // but that file is written to by the app on occasion. To avoid races, we shut the app
            // down before writing to the file.
            const childProcess = new ChildProcess();

            return childProcess
                .execToString("xcrun simctl spawn booted launchctl list")
                .then((output: string) => {
                    // Try to find an entry that looks like UIKitApplication:com.example.myApp[0x4f37]
                    const regex = new RegExp(`(\\S+${bundleId}\\S+)`);
                    const match = regex.exec(output);

                    // If we don't find a match, the app must not be running and so we do not need to close it
                    return match
                        ? childProcess.exec(`xcrun simctl spawn booted launchctl stop ${match[1]}`)
                        : null;
                })
                .then(() => {
                    // Write to the settings file while the app is not running to avoid races
                    return this.iosDebugModeManager.setSimulatorRemoteDebuggingSetting(
                        /*enable=*/ true,
                        this.runOptions.configuration,
                        this.runOptions.productName,
                    );
                })
                .then(() => {
                    // Relaunch the app
                    return this.runApp();
                });
        });
    }

    public disableJSDebuggingMode(): Promise<void> {
        if (this.targetType === IOSPlatform.deviceString) {
            return Promise.resolve();
        }
        return this.iosDebugModeManager.setSimulatorRemoteDebuggingSetting(
            /*enable=*/ false,
            this.runOptions.configuration,
            this.runOptions.productName,
        );
    }

    public prewarmBundleCache(): Promise<void> {
        return this.packager.prewarmBundleCache(PlatformType.iOS);
    }

    public getRunArguments(): string[] {
        let runArguments: string[] = [];

        if (this.runOptions.runArguments && this.runOptions.runArguments.length > 0) {
            runArguments = this.runOptions.runArguments;
            if (this.runOptions.scheme) {
                const schemeFromArgs = IOSPlatform.getOptFromRunArgs(
                    runArguments,
                    "--scheme",
                    false,
                );
                if (!schemeFromArgs) {
                    runArguments.push("--scheme", this.runOptions.scheme);
                } else {
                    this.logger.warning(
                        localize(
                            "iosSchemeParameterAlreadySetInRunArguments",
                            "'--scheme' is set as 'runArguments' configuration parameter value, 'scheme' configuration parameter value will be omitted",
                        ),
                    );
                }
            }
        } else {
            if (this.runOptions.target) {
                runArguments.push(...this.handleTargetArg(this.runOptions.target));
            }

            if (this.runOptions.iosRelativeProjectPath) {
                runArguments.push("--project-path", this.runOptions.iosRelativeProjectPath);
            }

            // provide any defined scheme
            if (this.runOptions.scheme) {
                runArguments.push("--scheme", this.runOptions.scheme);
            }
        }

        return runArguments;
    }

    private handleTargetArg(target: string): string[] {
        if (target === IOSPlatform.deviceString || target === IOSPlatform.simulatorString) {
            return [`--${this.runOptions.target}`];
        } else {
            if (target.indexOf(IOSPlatform.deviceString) !== -1) {
                const deviceArgs = target.split("=");
                return deviceArgs[1]
                    ? [`--${IOSPlatform.deviceString}`, deviceArgs[1]]
                    : [`--${IOSPlatform.deviceString}`];
            } else {
                return [`--${IOSPlatform.simulatorString}`, `${this.runOptions.target}`];
            }
        }
    }

    private generateSuccessPatterns(version: string): Promise<string[]> {
        // Clone RUN_IOS_SUCCESS_PATTERNS to avoid its runtime mutation
        let successPatterns = [...IOSPlatform.RUN_IOS_SUCCESS_PATTERNS];
        if (this.targetType === IOSPlatform.deviceString) {
            if (semver.gte(version, "0.60.0")) {
                successPatterns.push("success Installed the app on the device");
            } else {
                successPatterns.push("INSTALLATION SUCCEEDED");
            }
            return Promise.resolve(successPatterns);
        } else {
            return this.getBundleId().then(bundleId => {
                if (semver.gte(version, "0.60.0")) {
                    successPatterns.push(
                        `Launching "${bundleId}"\nsuccess Successfully launched the app `,
                    );
                } else {
                    successPatterns.push(`Launching ${bundleId}\n${bundleId}: `);
                }
                return successPatterns;
            });
        }
    }

    private getConfiguration(): string {
        return (
            IOSPlatform.getOptFromRunArgs(this.runArguments, this.configurationArgumentName) ||
            this.defaultConfiguration
        );
    }

    private getBundleId(): Promise<string> {
        let scheme = this.runOptions.scheme;
        if (!scheme) {
            const schemeFromArgs = IOSPlatform.getOptFromRunArgs(
                this.runArguments,
                "--scheme",
                false,
            );
            if (schemeFromArgs) {
                scheme = schemeFromArgs;
            }
        }
        return this.plistBuddy.getBundleId(
            this.iosProjectRoot,
            this.projectPath,
            true,
            this.runOptions.configuration,
            this.runOptions.productName,
            scheme,
        );
    }

    /*private static remote(fsPath: string): RemoteExtension { // TODO replace with a new implementation from appLauncher
        if (this.remoteExtension) {
            return this.remoteExtension;
        } else {
            return this.remoteExtension = RemoteExtension.atProjectRootPath(SettingsHelper.getReactNativeProjectRoot(fsPath));
        }
    }*/
}
