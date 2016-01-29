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

    private parsePlatformArg(): string {
        let launchArguments = process.argv.slice(2);
        return launchArguments[0].toLowerCase();
    }

    public launch() {
        let resolver = new PlatformResolver();
        let mobilePlatform = resolver.resolveMobilePlatform(this.parsePlatformArg());

        return Q({})
            .then(() => Q.delay(new Packager(this.projectRootPath).start(), 3000))
            .then(() => Q.delay(mobilePlatform.runApp(), 3000))
            .then(() => Q.delay(new DebuggerWorker(this.projectRootPath).start(), 3000)) // Start the worker
            .then(() => mobilePlatform.enableJSDebuggingMode())
            .done(() => { }, reason => {
                Log.logError("Cannot debug application.", reason);
            });
    }
}
