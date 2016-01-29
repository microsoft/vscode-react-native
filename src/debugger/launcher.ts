// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.

import * as Q from "q";
import {DebuggerWorker} from "./debuggerWorker";
import {Packager} from "./packager";
import {Log} from "../utils/commands/log";
import {PlatformResolver} from "./platformResolver";

export class Launcher {
    private projectRootPath: string;

    constructor(projectRootPath: string) {
        this.projectRootPath = projectRootPath;
    }

    /**
     * Parses the mobile platform argument set in the launch configuration.
     * This helps make the distinction between the different target platforms.
     */
    private parsePlatformArg(): string {
        let result: string = null;

        if (process.argv.length > 2) {
            result = process.argv[2].toLowerCase();
        }

        return result;
    }

    public launch() {
        let resolver = new PlatformResolver();
        let mobilePlatform = resolver.resolveMobilePlatform(this.parsePlatformArg());
        if (!mobilePlatform) {
            Log.logError("The target platform could not be read. Did you forget to add it to the launch.json configuration arguments?");
        } else {
            Q({})
                .then(() => Q.delay(new Packager(this.projectRootPath).start(), 3000))
                .then(() => Q.delay(mobilePlatform.runApp(), 3000))
                .then(() => Q.delay(new DebuggerWorker(this.projectRootPath).start(), 3000)) // Start the worker
                .then(() => mobilePlatform.enableJSDebuggingMode())
                .done(() => { }, reason => {
                    Log.logError("Cannot debug application.", reason);
                });
        }
    }
}
