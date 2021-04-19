// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.

import * as semver from "semver";
import { GeneralMobilePlatform, MobilePlatformDeps } from "../generalMobilePlatform";
import { ImacOSRunOptions, PlatformType } from "../launchArgs";
import { OutputVerifier, PatternToFailure } from "../../common/outputVerifier";
import { TelemetryHelper } from "../../common/telemetryHelper";
import { CommandExecutor } from "../../common/commandExecutor";
import { InternalErrorCode } from "../../common/error/internalErrorCode";

/**
 * macOS specific platform implementation for debugging RN applications.
 */
export class MacOSPlatform extends GeneralMobilePlatform {
    private static SUCCESS_PATTERNS = ["Launching app"];
    private static FAILURE_PATTERNS: PatternToFailure[] = [
        {
            pattern: "Unrecognized command 'run-macos'",
            errorCode: InternalErrorCode.ReactNativemacOSIsNotInstalled,
        },
    ];

    constructor(
        protected runOptions: ImacOSRunOptions,
        platformDeps: MobilePlatformDeps = {},
        nodeModulesRoot: string,
    ) {
        super(runOptions, platformDeps, nodeModulesRoot);
    }

    public runApp(): Promise<void> {
        let extProps = {
            platform: {
                value: PlatformType.macOS,
                isPii: false,
            },
        };

        extProps = TelemetryHelper.addPlatformPropertiesToTelemetryProperties(
            this.runOptions,
            this.runOptions.reactNativeVersions,
            extProps,
        );

        return TelemetryHelper.generate("MacOSPlatform.runApp", extProps, async () => {
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
                    MacOSPlatform.NO_PACKAGER_VERSION,
                )
            ) {
                this.runArguments.push("--no-packager");
            }

            const runmacOSSpawn = await new CommandExecutor(
                this.nodeModulesRoot,
                this.projectPath,
                this.logger,
            ).spawnReactCommand(`run-${this.platformName}`, this.runArguments, { env });
            return new OutputVerifier(
                () => Promise.resolve(MacOSPlatform.SUCCESS_PATTERNS),
                () => Promise.resolve(MacOSPlatform.FAILURE_PATTERNS),
                this.platformName,
            ).process(runmacOSSpawn);
        });
    }

    public prewarmBundleCache(): Promise<void> {
        return this.packager.prewarmBundleCache(PlatformType.macOS);
    }

    public getRunArguments(): string[] {
        let runArguments: string[] = [];

        if (this.runOptions.runArguments && this.runOptions.runArguments.length > 0) {
            runArguments.push(...this.runOptions.runArguments);
        } else {
            let target =
                this.runOptions.target === MacOSPlatform.simulatorString
                    ? ""
                    : this.runOptions.target;
            if (target) {
                runArguments.push(`--${target}`);
            }
        }

        return runArguments;
    }
}
