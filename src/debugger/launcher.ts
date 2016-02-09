// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.

import * as Q from "q";
import * as path from "path";
import {MultipleLifetimesAppWorker} from "./appWorker";
import {Packager} from "./packager";
import {Log} from "../utils/commands/log";
import {PlatformResolver} from "./platformResolver";
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
            Q({})
                .then(() => packager.start())
                // We've seen that if we don't prewarm the bundle cache, the app fails on the first attempt to connect to the debugger logic
                // and the user needs to Reload JS manually. We prewarm it to prevent that issue
                .then(() => packager.prewarmBundleCache(runOptions.platform))
                .then(() => mobilePlatform.runApp(runOptions))
                .then(() => new MultipleLifetimesAppWorker(sourcesStoragePath).start()) // Start the app worker
                .then(() => mobilePlatform.enableJSDebuggingMode(runOptions))
                .done(() => { }, reason => {
                    Log.logError("Cannot debug application.", reason);
                });
        }
    }

    /**
     * Parses the launch arguments set in the launch configuration.
     */
    private parseRunOptions(): IRunOptions {
        let result: IRunOptions = { projectRoot: this.projectRootPath };

        if (process.argv.length > 2) {
            result.platform = process.argv[2].toLowerCase();
        }

        result.target = process.argv[3];
        return result;
    }
}

