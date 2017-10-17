// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.

import * as Q from "q";
import * as path from "path";
import * as fs from "fs";
import stripJsonComments = require("strip-json-comments");

import { Telemetry } from "../common/telemetry";
import { TelemetryHelper } from "../common/telemetryHelper";
import { RemoteExtension } from "../common/remoteExtension";
import { ExtensionTelemetryReporter, ReassignableTelemetryReporter } from "../common/telemetryReporters";
import { ChromeDebugSession, IChromeDebugSessionOpts, ChromeDebugAdapter, logger  } from "vscode-chrome-debug-core";
import { ContinuedEvent, TerminatedEvent, Logger } from "vscode-debugadapter";
import { DebugProtocol } from "vscode-debugprotocol";

import { MultipleLifetimesAppWorker } from "./appWorker";


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
            this.requestSetup(request.arguments);
            this.remoteExtension.launch(request)
                .then(() => {
                    return this.remoteExtension.getPackagerPort(request.arguments.program);
                })
                .then((packagerPort: number) => {
                    this.attachRequest(request, packagerPort);
                })
                .catch(error => {
                    this.bailOut(error.data || error.message);
                });
        }

        private attach(request: DebugProtocol.Request): void {
            this.requestSetup(request.arguments);
            this.remoteExtension.getPackagerPort(request.arguments.program)
                .then((packagerPort: number) => {
                    this.attachRequest(request, packagerPort);
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
                    .catch(reason => logger.warn(`Couldn't stop monitoring logcat: ${reason.message || reason}`))
                    .finally(() => super.dispatchRequest(request));
            } else {
                super.dispatchRequest(request);
            }
        }

        private requestSetup(args: any): void {
            let logLevel: string = args.trace;
            if (logLevel) {
                logLevel = logLevel.replace(logLevel[0], logLevel[0].toUpperCase());
                logger.setup(Logger.LogLevel[logLevel], false);
            } else {
                logger.setup(Logger.LogLevel.Log, false);
            }

            this.projectRootPath = getProjectRoot(args);
            this.remoteExtension = RemoteExtension.atProjectRootPath(this.projectRootPath);

            // Start to send telemetry
            telemetryReporter.reassignTo(new ExtensionTelemetryReporter(
                appName, version, Telemetry.APPINSIGHTS_INSTRUMENTATIONKEY, this.projectRootPath));
        }

        /**
         * Runs logic needed to attach.
         * Attach should:
         * - Enable js debugging
         */
        // tslint:disable-next-line:member-ordering
        protected attachRequest(
            request: DebugProtocol.Request,
            packagerPort: number): Q.Promise<void> {
            return TelemetryHelper.generate("attach", (generator) => {
                return Q({})
                    .then(() => {
                        logger.log("Starting debugger app worker.");
                        // TODO: remove dependency on args.program - "program" property is technically
                        // no more required in launch configuration and could be removed
                        const workspaceRootPath = path.resolve(path.dirname(request.arguments.program), "..");
                        const sourcesStoragePath = path.join(workspaceRootPath, ".vscode", ".react");

                        // If launch is invoked first time, appWorker is undefined, so create it here
                        this.appWorker = new MultipleLifetimesAppWorker(packagerPort, sourcesStoragePath, this.projectRootPath);
                        this.appWorker.on("connected", (port: number) => {
                            logger.log("Debugger worker loaded runtime on port " + port);
                            // Don't mutate original request to avoid side effects
                            let attachArguments = Object.assign({}, request.arguments, { port, restart: true, request: "attach" });
                            let attachRequest = Object.assign({}, request, { command: "attach", arguments: attachArguments });

                            // Reinstantiate debug adapter, as the current implementation of ChromeDebugAdapter
                            // doesn't allow us to reattach to another debug target easily. As of now it's easier
                            // to throw previous instance out and create a new one.
                            (this as any)._debugAdapter = new (<any>debugSessionOpts.adapter)(debugSessionOpts, this);
                            super.dispatchRequest(attachRequest);
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
            logger.error(`Could not debug. ${message}`);
            this.sendEvent(new TerminatedEvent());
        }
    };
}

export function makeAdapter(debugAdapterClass: typeof ChromeDebugAdapter): typeof ChromeDebugAdapter {
    return class extends debugAdapterClass {
        public doAttach(port: number, targetUrl?: string, address?: string, timeout?: number): Promise<void> {
            // We need to overwrite ChromeDebug's _attachMode to let Node2 adapter
            // to set up breakpoints on initial pause event
            (this as any)._attachMode = false;
            return super.doAttach(port, targetUrl, address, timeout);
        }
    };
}

/**
 * Parses settings.json file for workspace root property
 */
function getProjectRoot(args: any): string {
    try {
        let vsCodeRoot = path.resolve(args.program, "../..");
        let settingsPath = path.resolve(vsCodeRoot, ".vscode/settings.json");
        let settingsContent = fs.readFileSync(settingsPath, "utf8");
        settingsContent = stripJsonComments(settingsContent);
        let parsedSettings = JSON.parse(settingsContent);
        let projectRootPath = parsedSettings["react-native-tools"].projectRoot;
        return path.resolve(vsCodeRoot, projectRootPath);
    } catch (e) {
        return path.resolve(args.program, "../..");
    }
}
