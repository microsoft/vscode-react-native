// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.

import * as Q from "q";
import * as semver from "semver";

import {MobilePlatformDeps} from "../generalMobilePlatform";
import {IWindowsRunOptions} from "../launchArgs";
import {TelemetryHelper} from "../../common/telemetryHelper";
import {CommandExecutor} from "../../common/commandExecutor";
import {ReactNativeProjectHelper} from "../../common/reactNativeProjectHelper";
import {WindowsPlatform} from "./windowsPlatform";

/**
 * WPF specific platform implementation for debugging RN applications.
 */
export class WpfPlatform extends WindowsPlatform {
    constructor(protected runOptions: IWindowsRunOptions, platformDeps: MobilePlatformDeps = {}) {
        super(runOptions, platformDeps);
    }

    public runApp(enableDebug: boolean = true): Q.Promise<void> {
        return TelemetryHelper.generate("WpfPlatform.runApp", () => {
            const runArguments = this.getRunArgument();
            const env = this.getEnvArgument();

            if (enableDebug) {
                runArguments.push("--proxy");
            }

            return ReactNativeProjectHelper.getReactNativeVersion(this.runOptions.projectRoot)
                .then(version => {
                    if (!semver.valid(version) /*Custom RN implementations should support this flag*/ || semver.gte(version, WpfPlatform.NO_PACKAGER_VERSION)) {
                        runArguments.push("--no-packager");
                    }

                    const runWpfSpawn = new CommandExecutor(this.projectPath, this.logger).spawnReactCommand(`run-${this.platformName}`, runArguments, {env});
                    return Q.Promise((resolve, reject) => {
                        let resolved = false;
                        let output = "";
                        runWpfSpawn.stdout.on("data", (data: Buffer) => {
                            output += data.toString();
                            if (!resolved && output.indexOf("Starting the app") > -1) {
                                resolved = true;
                                resolve(void 0);
                            }
                        });

                        runWpfSpawn.stderr.on("data", (data: Buffer) => {
                            reject(data.toString());
                        });

                        runWpfSpawn.outcome.then(() => {
                            reject(void 0); // If WPF process ended then app run fault
                        });
                    });
                });
        });
    }
}
