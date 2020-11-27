// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.

import * as semver from "semver";
import * as path from "path";
import { GeneralMobilePlatform } from "../generalMobilePlatform";
import { MobilePlatformDeps } from "../generalMobilePlatform";
import { IWindowsRunOptions, PlatformType } from "../launchArgs";
import { TelemetryHelper } from "../../common/telemetryHelper";
import { CommandExecutor } from "../../common/commandExecutor";
import { WindowsPlatform } from "./windowsPlatform";
import * as nls from "vscode-nls";
nls.config({
    messageFormat: nls.MessageFormat.bundle,
    bundleFormat: nls.BundleFormat.standalone,
})();
const localize = nls.loadMessageBundle();

/**
 * WPF specific platform implementation for debugging RN applications.
 */
export class WpfPlatform extends WindowsPlatform {
    private static WPF_SUPPORTED = "0.55.0";
    constructor(protected runOptions: IWindowsRunOptions, platformDeps: MobilePlatformDeps = {}) {
        super(runOptions, platformDeps);
    }

    public runApp(enableDebug: boolean = true): Promise<void> {
        let extProps = {
            platform: {
                value: PlatformType.WPF,
                isPii: false,
            },
        };

        extProps = TelemetryHelper.addPlatformPropertiesToTelemetryProperties(
            this.runOptions,
            this.runOptions.reactNativeVersions,
            extProps,
        );

        return TelemetryHelper.generate("WpfPlatform.runApp", extProps, () => {
            const env = GeneralMobilePlatform.getEnvArgument(
                process.env,
                this.runOptions.env,
                this.runOptions.envFile,
            );

            if (enableDebug) {
                this.runArguments.push("--proxy");
            }

            if (
                !semver.gt(
                    this.runOptions.reactNativeVersions.reactNativeVersion,
                    WpfPlatform.WPF_SUPPORTED,
                )
            ) {
                throw new Error(
                    localize(
                        "DebuggingWPFPlatformIsNotSupportedForThisRNWinVersion",
                        "Debugging WPF platform is not supported for this react-native-windows version({0})",
                        this.runOptions.reactNativeVersions.reactNativeVersion,
                    ),
                );
            }

            if (
                !semver.valid(
                    this.runOptions.reactNativeVersions.reactNativeVersion,
                ) /*Custom RN implementations should support this flag*/ ||
                semver.gte(
                    this.runOptions.reactNativeVersions.reactNativeVersion,
                    WpfPlatform.NO_PACKAGER_VERSION,
                )
            ) {
                this.runArguments.push("--no-packager");
            }

            const exec = new CommandExecutor(this.projectPath, this.logger);
            return new Promise((resolve, reject) => {
                const appName = this.projectPath.split(path.sep).pop();
                // Killing another instances of the app which were run earlier
                return exec.execute(`cmd /C Taskkill /IM ${appName}.exe /F`).finally(() => {
                    const runWpfSpawn = exec.spawnReactCommand(
                        `run-${this.platformName}`,
                        this.runArguments,
                        { env },
                    );
                    let resolved = false;
                    let output = "";
                    runWpfSpawn.stdout.on("data", (data: Buffer) => {
                        output += data.toString();
                        if (!resolved && output.indexOf("Starting the app") > -1) {
                            resolved = true;
                            resolve();
                        }
                    });

                    runWpfSpawn.stderr.on("data", (error: Buffer) => {
                        if (error.toString().trim()) {
                            reject(error.toString());
                        }
                    });

                    runWpfSpawn.outcome.then(() => {
                        reject(); // If WPF process ended then app run fault
                    });
                });
            });
        });
    }
}
