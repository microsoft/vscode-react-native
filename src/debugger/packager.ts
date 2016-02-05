// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.

import {IDesktopPlatform} from "./platformResolver";
import {PromiseUtil} from "../utils/node/promise";
import {Request} from "../utils/node/request";
import {CommandExecutor} from "../utils/commands/commandExecutor";
import {Log} from "../utils/commands/log";
import {Node} from "../utils/node/node";
import * as Q from "q";
import * as path from "path";

export class Packager {
    public static HOST = "localhost:8081";
    public static DEBUGGER_WORKER_FILE_BASENAME = "debuggerWorker";
    public static DEBUGGER_WORKER_FILENAME = Packager.DEBUGGER_WORKER_FILE_BASENAME + ".js";
    private projectPath: string;
    private sourcesStoragePath: string;
    private desktopPlatform: IDesktopPlatform;

    constructor(projectPath: string, desktopPlatform: IDesktopPlatform, sourcesStoragePath: string) {
        this.projectPath = projectPath;
        this.desktopPlatform = desktopPlatform;
        this.sourcesStoragePath = sourcesStoragePath;
    }

    private isRunning(): Q.Promise<boolean> {
        let statusURL = `http://${Packager.HOST}/status`;

        return new Request().request(statusURL)
            .then((body: string) => {
                return body === "packager-status:running";
            },
            (error: any) => {
                return false;
            });
    }

    private awaitStart(retryCount = 30, delay = 2000): Q.Promise<boolean> {
        let pu: PromiseUtil = new PromiseUtil();
        return pu.retryAsync(() => this.isRunning(), (running) => running, retryCount, delay, "Could not start the packager.");
    }

    private downloadDebuggerWorker(): Q.Promise<void> {
        let debuggerWorkerURL = `http://${Packager.HOST}/${Packager.DEBUGGER_WORKER_FILENAME}`;
        let debuggerWorkerLocalPath = path.join(this.sourcesStoragePath, Packager.DEBUGGER_WORKER_FILENAME);
        Log.logInternalMessage("About to download: " + debuggerWorkerURL + " to: " + debuggerWorkerLocalPath);
        return new Request().request(debuggerWorkerURL, true).then((body: string) => {
            return new Node.FileSystem().writeFile(debuggerWorkerLocalPath, body);
        });
    }

    public start(): Q.Promise<void> {
        this.isRunning().done(running => {
            if (!running) {
                let mandatoryArgs = ["start"];
                let args = mandatoryArgs.concat(this.desktopPlatform.reactPackagerExtraParameters);
                let childEnv = Object.assign({}, process.env, { REACT_DEBUGGER: "echo A debugger is not needed: " });

                // The packager will continue running while we debug the application, so we can"t
                // wait for this command to finish
                new CommandExecutor(this.projectPath).spawn(this.desktopPlatform.reactNativeCommandName, args, { env: childEnv }).done();
            }
        });

        return this.awaitStart().then(() => {
            Log.logMessage("Packager started.");
            return this.downloadDebuggerWorker();
        }).then(() => {
            Log.logMessage("Downloaded debuggerWorker.js (Logic to run the React Native app) from the Packager.");
        });
    }
}
