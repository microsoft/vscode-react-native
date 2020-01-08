// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.

import * as Q from "q";
import * as semver from "semver";

import {GeneralMobilePlatform, MobilePlatformDeps} from "../generalMobilePlatform";
import {IWindowsRunOptions} from "../launchArgs";
import {OutputVerifier, PatternToFailure} from "../../common/outputVerifier";
import {TelemetryHelper} from "../../common/telemetryHelper";
import {CommandExecutor} from "../../common/commandExecutor";
import { InternalErrorCode } from "../../common/error/internalErrorCode";
import { ProjectVersionHelper } from "../../common/projectVersionHelper";
import * as nls from "vscode-nls";
const localize = nls.loadMessageBundle();

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

        extProps = TelemetryHelper.addPropertyToTelemetryProperties(this.runOptions.reactNativeVersions.reactNativeVersion, "reactNativeVersion", extProps);
        extProps = TelemetryHelper.addPropertyToTelemetryProperties(this.runOptions.reactNativeVersions.reactNativeWindowsVersion, "reactNativeWindowsVersion", extProps);

        return TelemetryHelper.generate("WindowsPlatform.runApp", extProps, () => {
            const env = this.getEnvArgument();

            if (enableDebug) {
                this.runArguments.push("--proxy");
            }

            if (!semver.valid(this.runOptions.reactNativeVersions.reactNativeVersion) /*Custom RN implementations should support this flag*/ || semver.gte(this.runOptions.reactNativeVersions.reactNativeVersion, WindowsPlatform.NO_PACKAGER_VERSION)) {
                this.runArguments.push("--no-packager");
            }

            if (ProjectVersionHelper.isVersionError(this.runOptions.reactNativeVersions.reactNativeWindowsVersion)) {
                this.logger.warning(localize("ReactNativeWindowsNotInstalled", "It appears you don't have react-native-windows installed. Go to https://github.com/microsoft/react-native-windows#getting-started for more info."));
            }

            const runWindowsSpawn = new CommandExecutor(this.projectPath, this.logger).spawnReactCommand(`run-${this.platformName}`, this.runArguments, {env});
            return new OutputVerifier(() => Q(WindowsPlatform.SUCCESS_PATTERNS), () => Q(WindowsPlatform.FAILURE_PATTERNS), this.platformName)
                .process(runWindowsSpawn);
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
