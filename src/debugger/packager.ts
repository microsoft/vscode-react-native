// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.

import {ChildProcess} from "child_process";
import {CommandExecutor} from "../utils/commands/commandExecutor";
import {Log, LogLevel} from "../utils/commands/log";
import {Node} from "../utils/node/node";
import {OutputChannel} from "vscode";
import {PromiseUtil} from "../utils/node/promise";
import {Request} from "../utils/node/request";

import * as Q from "q";
import * as path from "path";

export class Packager {
    // TODO: Make the port configurable via a launch argument
    public static PORT = "8081";
    public static HOST = `localhost:${Packager.PORT}`;
    public static DEBUGGER_WORKER_FILE_BASENAME = "debuggerWorker";
    public static DEBUGGER_WORKER_FILENAME = Packager.DEBUGGER_WORKER_FILE_BASENAME + ".js";
    private projectPath: string;
    private packagerProcess: ChildProcess;
    private sourcesStoragePath: string;

    constructor(projectPath: string, sourcesStoragePath?: string) {
        this.projectPath = projectPath;
        this.sourcesStoragePath = sourcesStoragePath;
    }

    public start(outputChannel?: OutputChannel): Q.Promise<void> {
        this.isRunning().done(running => {
            if (!running) {
                let args = ["--port", Packager.PORT];
                let childEnvForDebugging = Object.assign({}, process.env, { REACT_DEBUGGER: "echo A debugger is not needed: " });

                Log.logMessage("Starting Packager", outputChannel);
                // The packager will continue running while we debug the application, so we can"t
                // wait for this command to finish

                let spawnOptions = { env: childEnvForDebugging };

                new CommandExecutor(this.projectPath).spawnReactCommand("start", args, spawnOptions, outputChannel).then((packagerProcess) => {
                    this.packagerProcess = packagerProcess;
                }).done();
            }
        });

        return this.awaitStart().then(() => {
            Log.logMessage("Packager started.", outputChannel);
            if (this.sourcesStoragePath) {
                return this.downloadDebuggerWorker().then(() => {
                    Log.logMessage("Downloaded debuggerWorker.js (Logic to run the React Native app) from the Packager.");
                });
            }
        });
    }

    public stop(outputChannel?: OutputChannel): void {
        Log.logMessage("Stopping Packager", outputChannel);

        if (this.packagerProcess) {
            this.packagerProcess.kill();
            this.packagerProcess = null;
            Log.logMessage("Packager stopped", outputChannel);
        } else {
            Log.logMessage("Packager not found", outputChannel);
        }
    }

    public prewarmBundleCache(platform: string) {
        let bundleURL = `http://${Packager.HOST}/index.${platform}.bundle`;
        Log.logInternalMessage(LogLevel.Info, "About to get: " + bundleURL);
        return new Request().request(bundleURL, true).then(() => {
            Log.logMessage("The Bundle Cache was prewarmed.");
        });
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
        Log.logInternalMessage(LogLevel.Info, "About to download: " + debuggerWorkerURL + " to: " + debuggerWorkerLocalPath);
        return new Request().request(debuggerWorkerURL, true).then((body: string) => {
            return new Node.FileSystem().writeFile(debuggerWorkerLocalPath, body);
        });
    }
}
