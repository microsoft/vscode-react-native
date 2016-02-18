// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.

import * as fs from "fs";
import * as path from "path";
import {MultipleLifetimesAppWorker} from "./appWorker";
import {Packager} from "../common/packager";
import {Log} from "../common/log";
import {PlatformResolver} from "./platformResolver";
import {Telemetry} from "../common/telemetry";
import {TelemetryHelper} from "../common/telemetryHelper";
import {IRunOptions} from "./launchArgs";

export class Launcher {
    private projectRootPath: string;

    constructor(projectRootPath: string) {
        this.projectRootPath = projectRootPath;
    }

    public launch() {
        let version = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "..", "package.json"), "utf-8")).version;

        // Enable telemetry
        Telemetry.init("react-native-debug-process", version, true).then(() => {
            TelemetryHelper.generate("launch", (generator) => {
                const resolver = new PlatformResolver();
                const runOptions = this.parseRunOptions();
                const mobilePlatform = resolver.resolveMobilePlatform(runOptions.platform);
                if (!mobilePlatform) {
                    Log.logError("The target platform could not be read. Did you forget to add it to the launch.json configuration arguments?");
                } else {
                    const sourcesStoragePath = path.join(this.projectRootPath, ".vscode", ".react");
                    const packager = new Packager(this.projectRootPath, sourcesStoragePath);
                    generator.step("startPackager");
                    return packager.start()
                        // We've seen that if we don't prewarm the bundle cache, the app fails on the first attempt to connect to the debugger logic
                        // and the user needs to Reload JS manually. We prewarm it to prevent that issue
                        .then(() => {
                            generator.step("prewarmBundleCache");
                            return packager.prewarmBundleCache(runOptions.platform);
                        })
                        .then(() => {
                            generator.step("mobilePlatform.runApp");
                            return mobilePlatform.runApp(runOptions);
                        })
                        .then(() => {
                            generator.step("Starting App Worker");
                            return new MultipleLifetimesAppWorker(sourcesStoragePath, runOptions.debugAdapterPort).start();
                        }) // Start the app worker
                        .then(() => {
                            generator.step("mobilePlatform.enableJSDebuggingMode");
                            return mobilePlatform.enableJSDebuggingMode(runOptions);
                        });
                }
            }).done(() => { },
                reason => {
                    Log.logError("Cannot debug application.", reason);
                });
        });
    }

    /**
     * Parses the launch arguments set in the launch configuration.
     */
    private parseRunOptions(): IRunOptions {
        const result: IRunOptions = { projectRoot: this.projectRootPath };
        // We expect our debugAdapter to pass in arguments as [platform, debugAdapterPort, target?];

        result.platform = process.argv[2].toLowerCase();
        result.debugAdapterPort = parseInt(process.argv[3], 10) || 9090;
        result.target = process.argv[4];

        return result;
    }
}

