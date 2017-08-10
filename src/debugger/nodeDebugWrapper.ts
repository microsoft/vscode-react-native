// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.

import * as Q from "q";
import * as path from "path";
import * as fs from "fs";
import stripJsonComments = require("strip-json-comments");

import { Telemetry } from "../common/telemetry";
import { TelemetryHelper } from "../common/telemetryHelper";
import { RemoteExtension } from "../common/remoteExtension";
import { IOSPlatform } from "./ios/iOSPlatform";
import { PlatformResolver } from "./platformResolver";
import { IRunOptions } from "../common/launchArgs";
import { TargetPlatformHelper } from "../common/targetPlatformHelper";
import { ExtensionTelemetryReporter, ReassignableTelemetryReporter } from "../common/telemetryReporters";
import { NodeDebugAdapterLogger } from "../common/log/loggers";
import { Log } from "../common/log/log";
import { LogLevel } from "../common/log/logHelper";
import { GeneralMobilePlatform } from "../common/generalMobilePlatform";

import { MultipleLifetimesAppWorker } from "./appWorker";

export function makeSession(
    debugSessionClass: typeof ChromeDebuggerCorePackage.ChromeDebugSession,
    debugSessionOpts: ChromeDebuggerCorePackage.IChromeDebugSessionOpts,
    debugAdapterPackage: typeof VSCodeDebugAdapterPackage,
    telemetryReporter: ReassignableTelemetryReporter,
    appName: string, version: string): typeof ChromeDebuggerCorePackage.ChromeDebugSession {

    return class extends debugSessionClass {

        private projectRootPath: string;
        private remoteExtension: RemoteExtension;
        private mobilePlatformOptions: IRunOptions;
        private appWorker: MultipleLifetimesAppWorker | null = null;

        constructor(debuggerLinesAndColumnsStartAt1?: boolean, isServer?: boolean) {
            super(debuggerLinesAndColumnsStartAt1, isServer, debugSessionOpts);
        }

        // Override ChromeDebugSession's sendEvent to control what we will send to client
        public sendEvent(event: VSCodeDebugAdapterPackage.Event): void {
            // Do not send "terminated" events signaling about session's restart to client as it would cause it
            // to restart adapter's process, while we want to stay alive and don't want to interrupt connection
            // to packager.

            if (event.event === "terminated" && event.body && event.body.restart) {

                // Worker has been reloaded and switched to "continue" state
                // So we have to send "continued" event to client instead of "terminated"
                // Otherwise client might mistakenly show "stopped" state
                let continuedEvent: VSCodeDebugAdapterPackage.ContinuedEvent = {
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

        protected dispatchRequest(request: VSCodeDebugAdapterPackage.Request): void {
            if (request.command === "disconnect")
                return this.disconnect(request);

            if (request.command === "attach")
                return this.attach(request);

            if (request.command === "launch")
                return this.launch(request);

            return super.dispatchRequest(request);
        }

        private launch(request: VSCodeDebugAdapterPackage.Request): void {
            this.requestSetup(request.arguments);
            this.mobilePlatformOptions.target = request.arguments.target || "simulator";
            this.mobilePlatformOptions.iosRelativeProjectPath = !isNullOrUndefined(request.arguments.iosRelativeProjectPath) ?
                request.arguments.iosRelativeProjectPath :
                IOSPlatform.DEFAULT_IOS_PROJECT_RELATIVE_PATH;

            // We add the parameter if it's defined (adapter crashes otherwise)
            if (!isNullOrUndefined(request.arguments.logCatArguments)) {
                this.mobilePlatformOptions.logCatArguments = [parseLogCatArguments(request.arguments.logCatArguments)];
            }

            if (!isNullOrUndefined(request.arguments.variant)) {
                this.mobilePlatformOptions.variant = request.arguments.variant;
            }

            if (!isNullOrUndefined(request.arguments.scheme)) {
                this.mobilePlatformOptions.scheme = request.arguments.scheme;
            }

            TelemetryHelper.generate("launch", (generator) => {
                return this.remoteExtension.getPackagerPort()
                    .then((packagerPort: number) => {
                        this.mobilePlatformOptions.packagerPort = packagerPort;
                        const mobilePlatform = new PlatformResolver()
                            .resolveMobilePlatform(request.arguments.platform, this.mobilePlatformOptions);

                        generator.step("checkPlatformCompatibility");
                        TargetPlatformHelper.checkTargetPlatformSupport(this.mobilePlatformOptions.platform);
                        generator.step("startPackager");
                        return mobilePlatform.startPackager()
                            .then(() => {
                                // We've seen that if we don't prewarm the bundle cache, the app fails on the first attempt to connect to the debugger logic
                                // and the user needs to Reload JS manually. We prewarm it to prevent that issue
                                generator.step("prewarmBundleCache");
                                Log.logMessage("Prewarming bundle cache. This may take a while ...");
                                return mobilePlatform.prewarmBundleCache();
                            })
                            .then(() => {
                                generator.step("mobilePlatform.runApp");
                                Log.logMessage("Building and running application.");
                                return mobilePlatform.runApp();
                            })
                            .then(() => {
                                return this.attachRequest(request, packagerPort, mobilePlatform);
                            });
                    })
                    .catch(error => this.bailOut(error.message));
            });

        }

        private attach(request: VSCodeDebugAdapterPackage.Request): void {
            this.requestSetup(request.arguments);
            this.remoteExtension.getPackagerPort()
                .then((packagerPort: number) => this.attachRequest(request, packagerPort));
        }

        private disconnect(request: VSCodeDebugAdapterPackage.Request): void {
            // The client is about to disconnect so first we need to stop app worker
            if (this.appWorker) {
                this.appWorker.stop();
            }

            // Then we tell the extension to stop monitoring the logcat, and then we disconnect the debugging session
            if (this.mobilePlatformOptions.platform === "android") {
                this.remoteExtension.stopMonitoringLogcat()
                    .catch(reason => Log.logError(`WARNING: Couldn't stop monitoring logcat: ${reason.message || reason}\n`))
                    .finally(() => super.dispatchRequest(request));
            } else {
                super.dispatchRequest(request);
            }
        }

        private requestSetup(args: any): void {
            this.projectRootPath = getProjectRoot(args);
            this.remoteExtension = RemoteExtension.atProjectRootPath(this.projectRootPath);
            this.mobilePlatformOptions = {
                projectRoot: this.projectRootPath,
                platform: args.platform,
            };

            // Start to send telemetry
            telemetryReporter.reassignTo(new ExtensionTelemetryReporter(
                appName, version, Telemetry.APPINSIGHTS_INSTRUMENTATIONKEY, this.projectRootPath));

            Log.SetGlobalLogger(new NodeDebugAdapterLogger(debugAdapterPackage, this));
        }

        /**
         * Runs logic needed to attach.
         * Attach should:
         * - Enable js debugging
         */
        private attachRequest(
            request: VSCodeDebugAdapterPackage.Request,
            packagerPort: number,
            mobilePlatform?: GeneralMobilePlatform): Q.Promise<void> {
            return TelemetryHelper.generate("attach", (generator) => {
                return Q({})
                    .then(() => {
                        generator.step("mobilePlatform.enableJSDebuggingMode");
                        if (mobilePlatform) {
                            return mobilePlatform.enableJSDebuggingMode();
                        } else {
                            Log.logMessage("Debugger ready. Enable remote debugging in app.");
                            return void 0;
                        }
                    })
                    .then(() => {

                        Log.logMessage("Starting debugger app worker.");
                        // TODO: remove dependency on args.program - "program" property is technically
                        // no more required in launch configuration and could be removed
                        const workspaceRootPath = path.resolve(path.dirname(request.arguments.program), "..");
                        const sourcesStoragePath = path.join(workspaceRootPath, ".vscode", ".react");

                        // If launch is invoked first time, appWorker is undefined, so create it here
                        this.appWorker = new MultipleLifetimesAppWorker(packagerPort, sourcesStoragePath);
                        this.appWorker.on("connected", (port: number) => {
                            Log.logMessage("Debugger worker loaded runtime on port " + port);
                            // Don't mutate original request to avoid side effects
                            let attachArguments = Object.assign({}, request.arguments, { port, restart: true, request: "attach" });
                            let attachRequest = Object.assign({}, request, { command: "attach", arguments: attachArguments });

                            // Reinstantiate debug adapter, as the current implementation of ChromeDebugAdapter
                            // doesn't allow us to reattach to another debug target easily. As of now it's easier
                            // to throw previous instance out and create a new one.
                            this._debugAdapter = new (<any>debugSessionOpts.adapter)(debugSessionOpts, this);
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
            Log.logError(`Could not debug. ${message}`);
            this.sendEvent(new debugAdapterPackage.TerminatedEvent());
        }
    };
}

export function makeAdapter(debugAdapterClass: typeof Node2DebugAdapterPackage.Node2DebugAdapter): typeof Node2DebugAdapterPackage.Node2DebugAdapter {
    return class extends debugAdapterClass {
        public doAttach(port: number, targetUrl?: string, address?: string, timeout?: number): Promise<void> {
            // We need to overwrite ChromeDebug's _attachMode to let Node2 adapter
            // to set up breakpoints on initial pause event
            this._attachMode = false;
            return super.doAttach(port, targetUrl, address, timeout);
        }

        public setBreakpoints(args: any, requestSeq: number, ids?: number[]): Promise<Node2DebugAdapterPackage.ISetBreakpointsResponseBody> {
            // We need to overwrite ChromeDebug's setBreakpoints to get rid unhandled rejections
            // when breakpoints are being set up unsuccessfully
            return super.setBreakpoints(args, requestSeq, ids).catch((err) => {
                Log.logInternalMessage(LogLevel.Error, err.message);
                return {
                    breakpoints: [],
                };
            });
        }
    };
}

/**
 * Parses log cat arguments to a string
 */
function parseLogCatArguments(userProvidedLogCatArguments: any): string {
    return Array.isArray(userProvidedLogCatArguments)
        ? userProvidedLogCatArguments.join(" ") // If it's an array, we join the arguments
        : userProvidedLogCatArguments; // If not, we leave it as-is
}

/**
 * Helper method to know if a value is either null or undefined
 */
function isNullOrUndefined(value: any): boolean {
    return typeof value === "undefined" || value === null;
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
