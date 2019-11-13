// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.

import * as Q from "q";
import * as semver from "semver";

import {GeneralMobilePlatform, MobilePlatformDeps} from "../generalMobilePlatform";
import {IWindowsRunOptions} from "../launchArgs";
import {OutputVerifier, PatternToFailure} from "../../common/outputVerifier";
import {TelemetryHelper} from "../../common/telemetryHelper";
import {CommandExecutor} from "../../common/commandExecutor";
import {ReactNativeProjectHelper} from "../../common/reactNativeProjectHelper";
import { InternalErrorCode } from "../../common/error/internalErrorCode";

/**
 * Windows specific platform implementation for debugging RN applications.
 */
export class WindowsPlatform extends GeneralMobilePlatform {
    protected static NO_PACKAGER_VERSION = "0.53.0";

    private static SUCCESS_PATTERNS = [
        "Installing new version of the app",
        "Starting the app",
    ];
    private static FAILURE_PATTERNS: PatternToFailure[] = [
        {
            pattern: "Unrecognized command 'run-windows'",
            errorCode: InternalErrorCode.WinRNMPPluginIsNotInstalled,
        },
    ];

    constructor(protected runOptions: IWindowsRunOptions, platformDeps: MobilePlatformDeps = {}) {
        super(runOptions, platformDeps);
    }

    public runApp(enableDebug: boolean = true): Q.Promise<void> {
        let extProps = {
            platform: {
                value: "windows",
                isPii: false,
            },
        };

        extProps = TelemetryHelper.addReactNativeVersionToEventProperties(this.runOptions.reactNativeVersions.reactNativeVersion, extProps);
        extProps = TelemetryHelper.addReactNativeVersionToEventProperties(this.runOptions.reactNativeVersions.reactNativeWindowsVersion, extProps, "reactNativeWindowsVersion");

        return TelemetryHelper.generate("WindowsPlatform.runApp", extProps, () => {
            const env = this.getEnvArgument();

            if (enableDebug) {
                this.runArguments.push("--proxy");
            }

            return ReactNativeProjectHelper.getReactNativeVersions(this.runOptions.projectRoot)
                .then(versions => {
                    if (!semver.valid(versions.reactNativeVersion) /*Custom RN implementations should support this flag*/ || semver.gte(versions.reactNativeVersion, WindowsPlatform.NO_PACKAGER_VERSION)) {
                        this.runArguments.push("--no-packager");
                    }

                    const runWindowsSpawn = new CommandExecutor(this.projectPath, this.logger).spawnReactCommand(`run-${this.platformName}`, this.runArguments, {env});
                    return new OutputVerifier(() => Q(WindowsPlatform.SUCCESS_PATTERNS), () => Q(WindowsPlatform.FAILURE_PATTERNS), this.platformName)
                        .process(runWindowsSpawn);
                });
        });
    }

    public prewarmBundleCache(): Q.Promise<void> {
        return this.packager.prewarmBundleCache("windows");
    }

    public getRunArguments(): string[] {
        let runArguments: string[] = [];

        if (this.runOptions.runArguments  && this.runOptions.runArguments.length > 0) {
            runArguments.push(...this.runOptions.runArguments);
        } else {
            let target = this.runOptions.target === WindowsPlatform.simulatorString ? "" : this.runOptions.target;
            if (target) {
                runArguments.push(`--${target}`);
            }
        }

        return runArguments;
    }
}
