// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.

import * as semver from "semver";
import { GeneralPlatform, MobilePlatformDeps, TargetType } from "../generalPlatform";
import { IWindowsRunOptions, PlatformType } from "../launchArgs";
import { OutputVerifier, PatternToFailure } from "../../common/outputVerifier";
import { TelemetryHelper } from "../../common/telemetryHelper";
import { CommandExecutor } from "../../common/commandExecutor";
import { InternalErrorCode } from "../../common/error/internalErrorCode";
import { AppLauncher } from "../appLauncher";
import { ProjectVersionHelper } from "../../common/projectVersionHelper";

/**
 * Windows specific platform implementation for debugging RN applications.
 */
export class WindowsPlatform extends GeneralPlatform {
    protected static NO_PACKAGER_VERSION = "0.53.0";

    private static readonly RNW_CLI_EXISTS_VERSION = "0.63.0";
    private static SUCCESS_PATTERNS = ["Starting the app"];
    private static FAILURE_PATTERNS: PatternToFailure[] = [
        {
            pattern: "Unrecognized command 'run-windows'",
            errorCode: InternalErrorCode.WinRNMPPluginIsNotInstalled,
        },
        {
            pattern: /×.+$/gm,
            errorCode: InternalErrorCode.WinRunCommandFailed,
        },
    ];

    public async reloadApp(appLauncher: AppLauncher): Promise<void> {
        const worker = appLauncher.getAppWorker();
        if (worker) {
            worker.reloadAppCommand();
        }
    }

    constructor(protected runOptions: IWindowsRunOptions, platformDeps: MobilePlatformDeps = {}) {
        super(runOptions, platformDeps);
    }

    public async runApp(enableDebug: boolean = true): Promise<void> {
        let extProps: any = {
            platform: {
                value: PlatformType.Windows,
                isPii: false,
            },
        };

        this.projectObserver?.updateRNWindowsProjectState(true);
        if (this.runOptions.isDirect) {
            extProps.isDirect = {
                value: true,
                isPii: false,
            };
            this.projectObserver?.updateRNWindowsHermesProjectState(true);
        }

        extProps = TelemetryHelper.addPlatformPropertiesToTelemetryProperties(
            this.runOptions,
            this.runOptions.reactNativeVersions,
            extProps,
        );

        await TelemetryHelper.generate("WindowsPlatform.runApp", extProps, async () => {
            const env = GeneralPlatform.getEnvArgument(
                process.env,
                this.runOptions.env,
                this.runOptions.envFile,
            );

            if (
                semver.gte(
                    this.runOptions.reactNativeVersions.reactNativeWindowsVersion,
                    WindowsPlatform.RNW_CLI_EXISTS_VERSION,
                ) ||
                ProjectVersionHelper.isCanaryVersion(
                    this.runOptions.reactNativeVersions.reactNativeWindowsVersion,
                )
            ) {
                this.runArguments.push("--logging");
                if (enableDebug) {
                    this.runOptions.isDirect
                        ? this.runArguments.push("--direct-debugging")
                        : this.runArguments.push("--remote-debugging");
                }
            }

            if (
                !semver.valid(
                    this.runOptions.reactNativeVersions.reactNativeVersion,
                ) /* Custom RN implementations should support this flag*/ ||
                semver.gte(
                    this.runOptions.reactNativeVersions.reactNativeVersion,
                    WindowsPlatform.NO_PACKAGER_VERSION,
                ) ||
                ProjectVersionHelper.isCanaryVersion(
                    this.runOptions.reactNativeVersions.reactNativeVersion,
                )
            ) {
                this.runArguments.push("--no-packager");
            }

            const runWindowsSpawn = new CommandExecutor(
                this.runOptions.nodeModulesRoot,
                this.projectPath,
                this.logger,
            ).spawnReactCommand(`run-${this.platformName}`, this.runArguments, { env });
            await new OutputVerifier(
                () => Promise.resolve(WindowsPlatform.SUCCESS_PATTERNS),
                () => Promise.resolve(WindowsPlatform.FAILURE_PATTERNS),
                this.platformName,
            ).process(runWindowsSpawn);
        });
    }

    public prewarmBundleCache(): Promise<void> {
        return this.packager.prewarmBundleCache(PlatformType.Windows);
    }

    public getRunArguments(): string[] {
        const runArguments: string[] = [];

        if (this.runOptions.runArguments && this.runOptions.runArguments.length > 0) {
            runArguments.push(...this.runOptions.runArguments);
        } else {
            const target =
                this.runOptions.target === TargetType.Simulator ? "" : this.runOptions.target;
            if (target) {
                runArguments.push(`--${target}`);
            }
        }

        return runArguments;
    }
}
