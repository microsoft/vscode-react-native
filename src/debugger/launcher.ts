// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.

// import * as Q from "q";
import * as path from "path";
import {MultipleLifetimesAppWorker} from "./appWorker";
import {Packager} from "../common/packager";
import {Log} from "../common/log";
import {PlatformResolver} from "./platformResolver";
import {TelemetryHelper} from "../common/telemetryHelper";
import {IRunOptions} from "./launchArgs";

export class Launcher {
    private projectRootPath: string;

    constructor(projectRootPath: string) {
        this.projectRootPath = projectRootPath;
    }

    public launch() {
        let resolver = new PlatformResolver();
        let runOptions = this.parseRunOptions();
        let mobilePlatform = resolver.resolveMobilePlatform(runOptions.platform);
        if (!mobilePlatform) {
            Log.logError("The target platform could not be read. Did you forget to add it to the launch.json configuration arguments?");
        } else {
            let sourcesStoragePath = path.join(this.projectRootPath, ".vscode", ".react");
            let packager = new Packager(this.projectRootPath, sourcesStoragePath);
            TelemetryHelper.generate("launch", (generator) => {
                return packager.start()
                // We've seen that if we don't prewarm the bundle cache, the app fails on the first attempt to connect to the debugger logic
                // and the user needs to Reload JS manually. We prewarm it to prevent that issue
                .then(() => {
                    generator.step("prewarmBundleCache");
                    packager.prewarmBundleCache(runOptions.platform);
                })
                .then(() => {
                    generator.step("mobilePlatform.runApp");
                    mobilePlatform.runApp(runOptions);
                })
                .then(() => {
                    generator.step("Starting App Worker");
                    new MultipleLifetimesAppWorker(sourcesStoragePath, runOptions.debugAdapterPort).start();
                }) // Start the app worker
                .then(() => {
                    generator.step("mobilePlatform.enableJSDebuggingMode");
                    mobilePlatform.enableJSDebuggingMode(runOptions);
                });
            }).done(() => { }, reason => {
               Log.logError("Cannot debug application.", reason);
            });
        }
    }

    /**
     * Parses the launch arguments set in the launch configuration.
     */
    private parseRunOptions(): IRunOptions {
        let result: IRunOptions = { projectRoot: this.projectRootPath };
        // We expect our debugAdapter to pass in arguments as [platform, debugAdapterPort, target?];

        result.platform = process.argv[2].toLowerCase();
        result.debugAdapterPort = parseInt(process.argv[3], 10) || 9090;
        result.target = process.argv[4];

        return result;
    }
}

