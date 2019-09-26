// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.

import * as Q from "q";
import * as path from "path";
import * as fs from "fs";
import stripJsonComments = require("strip-json-comments");
import { Telemetry } from "../common/telemetry";
import { TelemetryHelper } from "../common/telemetryHelper";
import { RemoteExtension } from "../common/remoteExtension";
import { RemoteTelemetryReporter, ReassignableTelemetryReporter } from "../common/telemetryReporters";
import { ChromeDebugSession, IChromeDebugSessionOpts, ChromeDebugAdapter, logger, Crdp, stoppedEvent, IOnPausedResult } from "vscode-chrome-debug-core";
import { ContinuedEvent, TerminatedEvent, Logger, Response } from "vscode-debugadapter";
import { DebugProtocol } from "vscode-debugprotocol";
import { MultipleLifetimesAppWorker } from "./appWorker";
import { ReactNativeProjectHelper } from "../common/reactNativeProjectHelper";
import * as nls from "vscode-nls";
import { ErrorHelper } from "../common/error/errorHelper";
import { InternalErrorCode } from "../common/error/internalErrorCode";
import { getLoggingDirectory } from "../extension/log/LogHelper";
import * as mkdirp from "mkdirp";
const localize = nls.loadMessageBundle();

export function makeSession(
    debugSessionClass: typeof ChromeDebugSession,
    debugSessionOpts: IChromeDebugSessionOpts,
    telemetryReporter: ReassignableTelemetryReporter,
    appName: string, version: string): typeof ChromeDebugSession {

    return class extends debugSessionClass {

        private projectRootPath: string;
        private remoteExtension: RemoteExtension;
        private appWorker: MultipleLifetimesAppWorker | null = null;

        constructor(debuggerLinesAndColumnsStartAt1?: boolean, isServer?: boolean) {
            super(debuggerLinesAndColumnsStartAt1, isServer, debugSessionOpts);
        }

        // Override ChromeDebugSession's sendEvent to control what we will send to client
        public sendEvent(event: DebugProtocol.Event): void {
            // Do not send "terminated" events signaling about session's restart to client as it would cause it
            // to restart adapter's process, while we want to stay alive and don't want to interrupt connection
            // to packager.

            if (event.event === "terminated" && event.body && event.body.restart) {

                // Worker has been reloaded and switched to "continue" state
                // So we have to send "continued" event to client instead of "terminated"
                // Otherwise client might mistakenly show "stopped" state
                let continuedEvent: ContinuedEvent = {
                    event: "continued",
                    type: "event",
                    seq: event["seq"], // tslint:disable-line
                    body: { threadId: event.body.threadId },
                };

                super.sendEvent(continuedEvent);
                return;
            }

            super.sendEvent(event);
        }

        protected dispatchRequest(request: DebugProtocol.Request): void {
            if (request.command === "disconnect")
                return this.disconnect(request);

            if (request.command === "attach")
                return this.attach(request);

            if (request.command === "launch")
                return this.launch(request);

            return super.dispatchRequest(request);
        }

        private launch(request: DebugProtocol.Request): void {
            this.requestSetup(request.arguments)
                .then(() => {
                    logger.verbose(`Handle launch request: ${JSON.stringify(request.arguments, null , 2)}`);
                    return this.remoteExtension.launch(request);
                })
                .then(() => {
                    return this.remoteExtension.getPackagerPort(request.arguments.cwd || request.arguments.program);
                })
                .then((packagerPort: number) => {
                    this.attachRequest({
                        ...request,
                        arguments: {
                            ...request.arguments,
                            port: packagerPort,
                        },
                    });
                })
                .catch(error => {
                    this.bailOut(error.data || error.message);
                });
        }

        private attach(request: DebugProtocol.Request): void {
            this.requestSetup(request.arguments)
                .then(() => {
                    logger.verbose(`Handle attach request: ${JSON.stringify(request.arguments, null , 2)}`);
                    return this.remoteExtension.getPackagerPort(request.arguments.cwd || request.arguments.program);
                })
                .then((packagerPort: number) => {
                    this.attachRequest({
                        ...request,
                        arguments: {
                            ...request.arguments,
                            port: request.arguments.port || packagerPort,
                        },
                    });
                })
                .catch(error => {
                    this.bailOut(error.data || error.message);
                });
        }

        private disconnect(request: DebugProtocol.Request): void {
            // The client is about to disconnect so first we need to stop app worker
            if (this.appWorker) {
                this.appWorker.stop();
            }

            // Then we tell the extension to stop monitoring the logcat, and then we disconnect the debugging session
            if (request.arguments.platform === "android") {
                this.remoteExtension.stopMonitoringLogcat()
                    .catch(reason => logger.warn(localize("CouldNotStopMonitoringLogcat", "Couldn't stop monitoring logcat: {0}", reason.message || reason)))
                    .finally(() => super.dispatchRequest(request));
            } else {
                super.dispatchRequest(request);
            }
        }

        private requestSetup(args: any): Q.Promise<void> {
            // If special env variables are defined, then write process outputs to file
            let chromeDebugCoreLogs = getLoggingDirectory();
            if (chromeDebugCoreLogs) {
                chromeDebugCoreLogs = path.join(chromeDebugCoreLogs, "ChromeDebugCoreLogs.txt");
            }
            let logLevel: string = args.trace;
            if (logLevel) {
                logLevel = logLevel.replace(logLevel[0], logLevel[0].toUpperCase());
                logger.setup(Logger.LogLevel[logLevel], chromeDebugCoreLogs || false);
            } else {
                logger.setup(Logger.LogLevel.Log, chromeDebugCoreLogs || false);
            }


            if (!args.sourceMaps) {
                args.sourceMaps = true;
            }
            const projectRootPath = getProjectRoot(args);
            return ReactNativeProjectHelper.isReactNativeProject(projectRootPath)
                .then((result) => {
                    if (!result) {
                        throw ErrorHelper.getInternalError(InternalErrorCode.NotInReactNativeFolderError);
                    }
                    this.projectRootPath = projectRootPath;
                    this.remoteExtension = RemoteExtension.atProjectRootPath(this.projectRootPath);

                    // Start to send telemetry
                    telemetryReporter.reassignTo(new RemoteTelemetryReporter(
                        appName, version, Telemetry.APPINSIGHTS_INSTRUMENTATIONKEY, this.projectRootPath));

                    if (args.program) {
                        // TODO: Remove this warning when program property will be completely removed
                        logger.warn(localize("ProgramPropertyDeprecationWarning", "Launched debug configuration contains 'program' property which is deprecated and will be removed soon. Please replace it with: \"cwd\": \"${workspaceFolder}\""));
                        const useProgramEvent = TelemetryHelper.createTelemetryEvent("useProgramProperty");
                        Telemetry.send(useProgramEvent);
                    }
                    if (args.cwd) {
                        // To match count of 'cwd' users with 'program' users. TODO: Remove when program property will be removed
                        const useCwdEvent = TelemetryHelper.createTelemetryEvent("useCwdProperty");
                        Telemetry.send(useCwdEvent);
                    }
                    return void 0;
                });
        }

        /**
         * Runs logic needed to attach.
         * Attach should:
         * - Enable js debugging
         */
        // tslint:disable-next-line:member-ordering
        protected attachRequest(request: DebugProtocol.Request): Q.Promise<void> {
            const extProps = {
                platform: {
                    value: request.arguments.platform,
                    isPii: false,
                },
            };

            return TelemetryHelper.generate("attach", extProps, (generator) => {
                return Q({})
                    .then(() => {
                        logger.log(localize("StartingDebuggerAppWorker", "Starting debugger app worker."));
                        // TODO: remove dependency on args.program - "program" property is technically
                        // no more required in launch configuration and could be removed
                        const workspaceRootPath = request.arguments.cwd ? path.resolve(request.arguments.cwd) : path.resolve(path.dirname(request.arguments.program), "..");
                        const sourcesStoragePath = path.join(workspaceRootPath, ".vscode", ".react");
                        // Create folder if not exist to avoid problems if
                        // RN project root is not a ${workspaceFolder}
                        mkdirp.sync(sourcesStoragePath);

                        // If launch is invoked first time, appWorker is undefined, so create it here
                        this.appWorker = new MultipleLifetimesAppWorker(
                            request.arguments,
                            sourcesStoragePath,
                            this.projectRootPath,
                            undefined);
                        this.appWorker.on("connected", (port: number) => {
                            logger.log(localize("DebuggerWorkerLoadedRuntimeOnPort", "Debugger worker loaded runtime on port {0}", port));
                            // Don't mutate original request to avoid side effects
                            let attachArguments = Object.assign({}, request.arguments, {
                                address: "localhost",
                                port,
                                restart: true,
                                request: "attach",
                                remoteRoot: undefined,
                                localRoot: undefined,
                            });
                            // Reinstantiate debug adapter, as the current implementation of ChromeDebugAdapter
                            // doesn't allow us to reattach to another debug target easily. As of now it's easier
                            // to throw previous instance out and create a new one.
                            (this as any)._debugAdapter = new (<any>debugSessionOpts.adapter)(debugSessionOpts, this);

                            // Explicity call _debugAdapter.attach() to prevent directly calling dispatchRequest()
                            // yield a response as "attach" even for "launch" request. Because dispatchRequest() will
                            // decide to do a sendResponse() aligning with the request parameter passed in.
                            Q((this as any)._debugAdapter.attach(attachArguments, request.seq))
                                .then((responseBody) => {
                                    const response: DebugProtocol.Response = new Response(request);
                                    response.body = responseBody;
                                    this.sendResponse(response);
                                });
                        });

                        return this.appWorker.start();
                    })
                    .catch(error => this.bailOut(error.message));
            });
        }

        /**
         * Logs error to user and finishes the debugging process.
         */
        private bailOut(message: string): void {
            logger.error(localize("CouldNotDebug", "Could not debug. {0}" , message));
            this.sendEvent(new TerminatedEvent());
        }
    };
}

export function makeAdapter(debugAdapterClass: typeof ChromeDebugAdapter): typeof ChromeDebugAdapter {
    return class extends debugAdapterClass {
        private firstStop: boolean = true;
        public doAttach(port: number, targetUrl?: string, address?: string, timeout?: number): Promise<void> {
            // We need to overwrite ChromeDebug's _attachMode to let Node2 adapter
            // to set up breakpoints on initial pause event
            (this as any)._attachMode = false;
            return super.doAttach(port, targetUrl, address, timeout);
        }

        // Since the bundle runs inside the Node.js VM in debuggerWorker.js in runtime
        // Node debug adapter need time to parse new added code source maps
        // So we added 'debugger;' statement at the start of the bundle code
        // and wait for the adapter to receive signal to stop on that statement
        // and then wait for code bundle to be processed and then send continue request to skip the code execution stop in VS Code UI
        public onPaused(notification: Crdp.Debugger.PausedEvent, expectingStopReason?: stoppedEvent.ReasonType): Promise<IOnPausedResult> {
            if (this.firstStop) {
                return new Promise<IOnPausedResult>(() => {
                    setTimeout(() => {
                        if (notification.reason === "other") {
                            this.firstStop = false;
                            this.continue();
                        }
                        return super.onPaused(notification, expectingStopReason);
                    }, 50);
                });
            } else {
                return super.onPaused(notification, expectingStopReason);
            }
        }

        public async terminate(args: DebugProtocol.TerminatedEvent) {
            return this.disconnect({
                terminateDebuggee: true,
            });
        }
    };
}

/**
 * Parses settings.json file for workspace root property
 */
export function getProjectRoot(args: any): string {
    try {
        let vsCodeRoot = args.cwd ? path.resolve(args.cwd) : path.resolve(args.program, "../..");
        let settingsPath = path.resolve(vsCodeRoot, ".vscode/settings.json");
        let settingsContent = fs.readFileSync(settingsPath, "utf8");
        settingsContent = stripJsonComments(settingsContent);
        let parsedSettings = JSON.parse(settingsContent);
        let projectRootPath = parsedSettings["react-native-tools.projectRoot"] || parsedSettings["react-native-tools"].projectRoot;
        return path.resolve(vsCodeRoot, projectRootPath);
    } catch (e) {
        return args.cwd ? path.resolve(args.cwd) : path.resolve(args.program, "../..");
    }
}
