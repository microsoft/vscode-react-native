// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.

import * as path from "path";
import * as url from "url";
import * as cp from "child_process";
import * as fs from "fs";
import { logger } from "vscode-debugadapter";
import { ErrorHelper } from "../common/error/errorHelper";
import { InternalErrorCode } from "../common/error/internalErrorCode";
import { getLoggingDirectory } from "../extension/log/LogHelper";
import { generateRandomPortNumber } from "../common/extensionHelper";
import { IDebuggeeWorker, RNAppMessage } from "./appWorker";
import { ScriptImporter } from "./scriptImporter";

function printDebuggingError(error: Error, reason: any) {
    const nestedError = ErrorHelper.getNestedError(
        error,
        InternalErrorCode.DebuggingWontWorkReloadJSAndReconnect,
        reason,
    );

    logger.error(nestedError.message);
}

/** This class will run the RN App logic inside a forked Node process. The framework to run the logic is provided by the file
 * debuggerWorker.js (designed to run on a WebWorker). We add a couple of tweaks (mostly to polyfill WebWorker API) to that
 * file and load it inside of a process.
 * On this side we listen to IPC messages and either respond to them or redirect them to packager via MultipleLifetimeAppWorker's
 * instance. We also intercept packager's signal to load the bundle's code and mutate the message with path to file we've downloaded
 * to let importScripts function take this file.
 */
export class ForkedAppWorker implements IDebuggeeWorker {
    protected scriptImporter: ScriptImporter;
    protected debuggeeProcess: cp.ChildProcess | null = null;
    /** A promise that we use to make sure that worker has been loaded completely before start sending IPC messages */
    protected workerLoaded: Promise<void> | undefined;
    private bundleLoaded: Promise<void> | undefined;
    private logWriteStream: fs.WriteStream;
    private logDirectory: string | null;

    constructor(
        private packagerAddress: string,
        private packagerPort: number,
        private sourcesStoragePath: string,
        private projectRootPath: string,
        private postReplyToApp: (message: any) => void,
        private packagerRemoteRoot?: string,
        private packagerLocalRoot?: string,
    ) {
        this.scriptImporter = new ScriptImporter(
            this.packagerAddress,
            this.packagerPort,
            this.sourcesStoragePath,
            this.packagerRemoteRoot,
            this.packagerLocalRoot,
        );
    }

    public stop(): void {
        if (this.debuggeeProcess) {
            logger.verbose(`About to kill debuggee with pid ${this.debuggeeProcess.pid}`);
            this.debuggeeProcess.kill();
            this.debuggeeProcess = null;
        }
    }

    public async start(): Promise<number> {
        const scriptToRunPath = path.resolve(
            this.sourcesStoragePath,
            ScriptImporter.DEBUGGER_WORKER_FILENAME,
        );
        const port = generateRandomPortNumber();

        // Note that we set --inspect-brk flag to pause the process on the first line - this is
        // required for debug adapter to set the breakpoints BEFORE the debuggee has started.
        // The adapter will continue execution once it's done with breakpoints.
        // --no-deprecation flag disables deprecation warnings like "[DEP0005] DeprecationWarning: Buffer() is deprecated..." and so on that leads to errors in native app
        // https://nodejs.org/dist/latest-v7.x/docs/api/cli.html
        const nodeArgs = [`--inspect-brk=${port}`, "--no-deprecation", scriptToRunPath];
        // Start child Node process in debugging mode
        // Using fork instead of spawn causes breakage of piping between app worker and VS Code debug console, e.g. console.log() in application
        // wouldn't work. Please see https://github.com/microsoft/vscode-react-native/issues/758
        this.debuggeeProcess = cp
            .spawn("node", nodeArgs, {
                stdio: ["pipe", "pipe", "pipe", "ipc"],
            })
            .on("message", (message: any) => {
                // 'workerLoaded' is a special message that indicates that worker is done with loading.
                // We need to wait for it before doing any IPC because process.send doesn't seems to care
                // about whether the message has been received or not and the first messages are often get
                // discarded by spawned process
                if (message && message.workerLoaded) {
                    this.workerLoaded = Promise.resolve();
                    return;
                }

                this.postReplyToApp(message);
            })
            .on("error", (error: Error) => {
                printDebuggingError(
                    ErrorHelper.getInternalError(
                        InternalErrorCode.ReactNativeWorkerProcessThrownAnError,
                    ),
                    error,
                );
            });

        // If special env variables are defined, then write process outputs to file
        this.logDirectory = getLoggingDirectory();

        if (this.logDirectory) {
            this.logWriteStream = fs.createWriteStream(
                path.join(this.logDirectory, "nodeProcessLog.txt"),
            );
            this.logWriteStream.on("error", err => {
                logger.error(
                    `Error creating log file at path: ${String(this.logDirectory)}. Error: ${String(
                        err.toString(),
                    )}\n`,
                );
            });
            this.debuggeeProcess.stdout.pipe(this.logWriteStream);
            this.debuggeeProcess.stderr.pipe(this.logWriteStream);
            this.debuggeeProcess.on("close", () => {
                this.logWriteStream.end();
            });
        }

        // Resolve with port debugger server is listening on
        // This will be sent to subscribers of MLAppWorker in "connected" event
        logger.verbose(
            `Spawned debuggee process with pid ${this.debuggeeProcess.pid} listening to ${port}`,
        );

        return port;
    }

    public async postMessage(rnMessage: RNAppMessage): Promise<RNAppMessage> {
        // Before sending messages, make sure that the worker is loaded
        await new Promise<void>(resolve => {
            if (this.workerLoaded) {
                resolve();
            } else {
                const checkWorkerLoaded = setInterval(() => {
                    if (this.workerLoaded) {
                        clearInterval(checkWorkerLoaded);
                        resolve();
                    }
                }, 1000);
            }
        });

        const promise = (async () => {
            await this.workerLoaded;

            if (rnMessage.method !== "executeApplicationScript") {
                // Before sending messages, make sure that the app script executed
                await this.bundleLoaded;
                return rnMessage;
            }
            // When packager asks worker to load bundle we download that bundle and
            // then set url field to point to that downloaded bundle, so the worker
            // will take our modified bundle
            if (rnMessage.url) {
                const packagerUrl = url.parse(rnMessage.url);
                packagerUrl.host = `${this.packagerAddress}:${this.packagerPort}`;
                rnMessage = {
                    ...rnMessage,
                    url: url.format(packagerUrl),
                };
                logger.verbose(
                    `Packager requested runtime to load script from ${String(rnMessage.url)}`,
                );
                const downloadedScript = await this.scriptImporter.downloadAppScript(
                    <string>rnMessage.url,
                    this.projectRootPath,
                );
                this.bundleLoaded = Promise.resolve();
                return Object.assign({}, rnMessage, {
                    url: `${this.pathToFileUrl(downloadedScript.filepath)}`,
                });
            }
            throw ErrorHelper.getInternalError(
                InternalErrorCode.RNMessageWithMethodExecuteApplicationScriptDoesntHaveURLProperty,
            );
        })();
        promise.then(
            (message: RNAppMessage) => {
                if (this.debuggeeProcess) {
                    this.debuggeeProcess.send({ data: message });
                }
            },
            reason =>
                printDebuggingError(
                    ErrorHelper.getInternalError(
                        InternalErrorCode.CouldntImportScriptAt,
                        rnMessage.url,
                    ),
                    reason,
                ),
        );
        return promise;
    }

    // TODO: Replace by url.pathToFileURL method when Node 10 LTS become deprecated
    public pathToFileUrl(url: string): string {
        const filePrefix = process.platform === "win32" ? "file:///" : "file://";
        return filePrefix + url;
    }
}
