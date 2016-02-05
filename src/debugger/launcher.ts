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

    public launch() {
        let resolver = new PlatformResolver();
        let runOptions = this.parseRunOptions();
        let desktopPlatform = resolver.resolveDesktopPlatform();
        let mobilePlatform = resolver.resolveMobilePlatform(runOptions.platform, desktopPlatform);
        if (!mobilePlatform) {
            Log.logError("The target platform could not be read. Did you forget to add it to the launch.json configuration arguments?");
        } else {
            let sourcesStoragePath = path.join(this.projectRootPath, ".vscode/.react");
            // TODO: We need to remove all the delays, yet make sure things work properly for both Android and iOS
            Q({})
                .then(() => Q.delay(new Packager(this.projectRootPath, desktopPlatform, sourcesStoragePath).start(), 3000))
                .then(() => Q.delay(mobilePlatform.runApp(runOptions), 3000))
                .then(() => Q.delay(new MultipleLifetimesAppWorker(sourcesStoragePath).start(), 3000)) // Start the app worker
                .then(() => mobilePlatform.enableJSDebuggingMode(runOptions))
                .done(() => { }, reason => {
                    Log.logError("Cannot debug application.", reason);
                });
        }
    }
}

