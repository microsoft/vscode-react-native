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
            message: "'rnpm-plugin-windows' doesn't install",
        },
    ];

    constructor(protected runOptions: IWindowsRunOptions, platformDeps: MobilePlatformDeps = {}) {
        super(runOptions, platformDeps);
    }

    public runApp(enableDebug: boolean = true): Q.Promise<void> {
        return TelemetryHelper.generate("WindowsPlatform.runApp", () => {
            const runArguments = this.getRunArgument();
            const env = this.getEnvArgument();

            if (enableDebug) {
                runArguments.push("--proxy");
            }

            return ReactNativeProjectHelper.getReactNativeVersion(this.runOptions.projectRoot)
                .then(version => {
                    if (!semver.valid(version) /*Custom RN implementations should support this flag*/ || semver.gte(version, WindowsPlatform.NO_PACKAGER_VERSION)) {
                        runArguments.push("--no-packager");
                    }

                    const runWindowsSpawn = new CommandExecutor(this.projectPath, this.logger).spawnReactCommand(`run-${this.platformName}`, runArguments, {env});
                    return new OutputVerifier(() => Q(WindowsPlatform.SUCCESS_PATTERNS), () => Q(WindowsPlatform.FAILURE_PATTERNS), this.platformName)
                        .process(runWindowsSpawn);
                });
        });
    }

    public prewarmBundleCache(): Q.Promise<void> {
        return this.packager.prewarmBundleCache("windows");
    }

    public getRunArgument(): string[] {
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
