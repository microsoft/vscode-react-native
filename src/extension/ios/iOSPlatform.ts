// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.

import * as path from "path";
import * as semver from "semver";

import * as nls from "vscode-nls";
import { ChildProcess } from "../../common/node/childProcess";
import { CommandExecutor } from "../../common/commandExecutor";
import { MobilePlatformDeps, TargetType } from "../generalPlatform";
import { IIOSRunOptions, PlatformType } from "../launchArgs";
import { OutputVerifier, PatternToFailure } from "../../common/outputVerifier";
import { TelemetryHelper } from "../../common/telemetryHelper";
import { InternalErrorCode } from "../../common/error/internalErrorCode";
import { AppLauncher } from "../appLauncher";
import { GeneralMobilePlatform } from "../generalMobilePlatform";
import { ErrorHelper } from "../../common/error/errorHelper";
import { IDebuggableIOSTarget, IOSTarget, IOSTargetManager } from "./iOSTargetManager";
import { IOSDebugModeManager } from "./iOSDebugModeManager";
import { PlistBuddy } from "./plistBuddy";

nls.config({
    messageFormat: nls.MessageFormat.bundle,
    bundleFormat: nls.BundleFormat.standalone,
})();
const localize = nls.loadMessageBundle();

export class IOSPlatform extends GeneralMobilePlatform {
    public static DEFAULT_IOS_PROJECT_RELATIVE_PATH = "ios";

    private plistBuddy = new PlistBuddy();
    private iosProjectRoot: string;
    private iosDebugModeManager: IOSDebugModeManager;

    private defaultConfiguration: string = "Debug";
    private configurationArgumentName: string = "--configuration";

    protected target?: IOSTarget;

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

    constructor(protected runOptions: IIOSRunOptions, platformDeps: MobilePlatformDeps = {}) {
        super(runOptions, platformDeps);

        this.targetManager = new IOSTargetManager();
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
            schemeFromArgs ? schemeFromArgs : this.runOptions.scheme,
        );
    }

    public async getTarget(): Promise<IOSTarget> {
        if (!this.target) {
            const targetFromRunArgs = await this.getTargetFromRunArgs();
            if (targetFromRunArgs) {
                this.target = targetFromRunArgs;
            } else {
                const targets =
                    (await this.targetManager.getTargetList()) as IDebuggableIOSTarget[];
                const targetsBySpecifiedType = targets.filter(target => {
                    switch (this.runOptions.target) {
                        case TargetType.Simulator:
                            return target.isVirtualTarget;
                        case TargetType.Device:
                            return !target.isVirtualTarget;
                        case undefined:
                        case "":
                            return true;
                        default:
                            return (
                                target.id === this.runOptions.target ||
                                target.name === this.runOptions.target
                            );
                    }
                });
                if (targetsBySpecifiedType.length) {
                    this.target = IOSTarget.fromInterface(targetsBySpecifiedType[0]);
                } else if (targets.length) {
                    this.logger.warning(
                        localize(
                            "ThereIsNoTargetWithSpecifiedTargetType",
                            "There is no any target with specified target type '{0}'. Continue with any target.",
                            this.runOptions.target,
                        ),
                    );
                    this.target = IOSTarget.fromInterface(targets[0]);
                } else {
                    throw ErrorHelper.getInternalError(
                        InternalErrorCode.IOSThereIsNoAnyDebuggableTarget,
                    );
                }
            }
        }
        return this.target;
    }

    public async showDevMenu(appLauncher: AppLauncher): Promise<void> {
        const worker = appLauncher.getAppWorker();
        if (worker) {
            worker.showDevMenuCommand();
        }
    }

    public async reloadApp(appLauncher: AppLauncher): Promise<void> {
        const worker = appLauncher.getAppWorker();
        if (worker) {
            worker.reloadAppCommand();
        }
    }

    public async runApp(): Promise<void> {
        let extProps: any = {
            platform: {
                value: PlatformType.iOS,
                isPii: false,
            },
        };

        if (this.runOptions.isDirect) {
            extProps.isDirect = {
                value: true,
                isPii: false,
            };
            this.projectObserver?.updateRNIosHermesProjectState(true);
        }

        extProps = TelemetryHelper.addPlatformPropertiesToTelemetryProperties(
            this.runOptions,
            this.runOptions.reactNativeVersions,
            extProps,
        );

        await TelemetryHelper.generate("iOSPlatform.runApp", extProps, async () => {
            // Compile, deploy, and launch the app on either a simulator or a device
            const env = GeneralMobilePlatform.getEnvArgument(
                process.env,
                this.runOptions.env,
                this.runOptions.envFile,
            );

            if (
                !semver.valid(
                    this.runOptions.reactNativeVersions.reactNativeVersion,
                ) /* Custom RN implementations should support this flag*/ ||
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
            const runIosSpawn = new CommandExecutor(
                this.runOptions.nodeModulesRoot,
                this.projectPath,
                this.logger,
            ).spawnReactCommand("run-ios", this.runArguments, { env });
            await new OutputVerifier(
                () =>
                    this.generateSuccessPatterns(
                        this.runOptions.reactNativeVersions.reactNativeVersion,
                    ),
                () => Promise.resolve(IOSPlatform.RUN_IOS_FAILURE_PATTERNS),
                PlatformType.iOS,
            ).process(runIosSpawn);
        });
    }

    public async enableJSDebuggingMode(): Promise<void> {
        // Configure the app for debugging
        if (!(await this.getTarget()).isVirtualTarget) {
            // Note that currently we cannot automatically switch the device into debug mode.
            this.logger.info(
                "Application is running on a device, please shake device and select 'Debug JS Remotely' to enable debugging.",
            );
            return;
        }

        // Wait until the configuration file exists, and check to see if debugging is enabled
        const [debugModeEnabled, bundleId] = await Promise.all<boolean | string>([
            this.iosDebugModeManager.getAppRemoteDebuggingSetting(
                this.runOptions.configuration,
                this.runOptions.productName,
            ),
            this.getBundleId(),
        ]);
        if (debugModeEnabled) {
            return;
        }
        // Debugging must still be enabled
        // We enable debugging by writing to a plist file that backs a NSUserDefaults object,
        // but that file is written to by the app on occasion. To avoid races, we shut the app
        // down before writing to the file.
        const childProcess = new ChildProcess();
        const output = await childProcess.execToString("xcrun simctl spawn booted launchctl list");
        // Try to find an entry that looks like UIKitApplication:com.example.myApp[0x4f37]
        const regex = new RegExp(`(\\S+${String(bundleId)}\\S+)`);
        const match = regex.exec(output);
        // If we don't find a match, the app must not be running and so we do not need to close it
        if (match) {
            await childProcess.exec(`xcrun simctl spawn booted launchctl stop ${match[1]}`);
        }
        // Write to the settings file while the app is not running to avoid races
        await this.iosDebugModeManager.setAppRemoteDebuggingSetting(
            /* enable=*/ true,
            this.runOptions.configuration,
            this.runOptions.productName,
        );
        // Relaunch the app
        return await this.runApp();
    }

    public async disableJSDebuggingMode(): Promise<void> {
        if (!(await this.getTarget()).isVirtualTarget) {
            return;
        }
        return this.iosDebugModeManager.setAppRemoteDebuggingSetting(
            /* enable=*/ false,
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

    public async getTargetFromRunArgs(): Promise<IOSTarget | undefined> {
        if (this.runOptions.runArguments && this.runOptions.runArguments.length > 0) {
            const targets = (await this.targetManager.getTargetList()) as IDebuggableIOSTarget[];

            const udid = GeneralMobilePlatform.getOptFromRunArgs(
                this.runOptions.runArguments,
                "--udid",
            );
            if (udid) {
                const target = targets.find(target => target.id === udid);
                if (target) {
                    return IOSTarget.fromInterface(target);
                }
                this.logger.warning(
                    localize(
                        "ThereIsNoIosTargetWithSuchUdid",
                        "There is no iOS target with such UDID: {0}",
                        udid,
                    ),
                );
            }

            const device = GeneralMobilePlatform.getOptFromRunArgs(
                this.runOptions.runArguments,
                "--device",
            );
            if (device) {
                const target = targets.find(
                    target => !target.isVirtualTarget && target.name === device,
                );
                if (target) {
                    return IOSTarget.fromInterface(target);
                }
                this.logger.warning(
                    localize(
                        "ThereIsNoIosDeviceWithSuchName",
                        "There is no iOS device with such name: {0}",
                        device,
                    ),
                );
            }

            const simulator = GeneralMobilePlatform.getOptFromRunArgs(
                this.runOptions.runArguments,
                "--simulator",
            );
            if (simulator) {
                const target = targets.find(
                    target => target.isVirtualTarget && target.name === simulator,
                );
                if (target) {
                    return IOSTarget.fromInterface(target);
                }
                this.logger.warning(
                    localize(
                        "ThereIsNoIosSimulatorWithSuchName",
                        "There is no iOS simulator with such name: {0}",
                        simulator,
                    ),
                );
            }
        }

        return undefined;
    }

    private handleTargetArg(target: string): string[] {
        return target === TargetType.Device || target === TargetType.Simulator
            ? [`--${target}`]
            : ["--udid", target];
    }

    private async generateSuccessPatterns(version: string): Promise<string[]> {
        // Clone RUN_IOS_SUCCESS_PATTERNS to avoid its runtime mutation
        const successPatterns = [...IOSPlatform.RUN_IOS_SUCCESS_PATTERNS];
        if (!(await this.getTarget()).isVirtualTarget) {
            if (semver.gte(version, "0.60.0")) {
                successPatterns.push("success Installed the app on the device");
            } else {
                successPatterns.push("INSTALLATION SUCCEEDED");
            }
            return successPatterns;
        }
        const bundleId = await this.getBundleId();
        if (semver.gte(version, "0.60.0")) {
            successPatterns.push(`Launching "${bundleId}"\nsuccess Successfully launched the app `);
        } else {
            successPatterns.push(`Launching ${bundleId}\n${bundleId}: `);
        }
        return successPatterns;
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
            PlatformType.iOS,
            true,
            this.runOptions.configuration,
            this.runOptions.productName,
            scheme,
        );
    }
}
