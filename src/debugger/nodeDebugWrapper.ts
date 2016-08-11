// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.

import * as Q from "q";
import * as path from "path";
import * as http from "http";

import {Telemetry} from "../common/telemetry";
import {TelemetryHelper} from "../common/telemetryHelper";
import {RemoteExtension} from "../common/remoteExtension";
import {IOSPlatform} from "./ios/iOSPlatform";
import {PlatformResolver} from "./platformResolver";
import {IRunOptions} from "../common/launchArgs";
import {TargetPlatformHelper} from "../common/targetPlatformHelper";
import {ExtensionTelemetryReporter, ReassignableTelemetryReporter} from "../common/telemetryReporters";
import {NodeDebugAdapterLogger} from "../common/log/loggers";
import {Log} from "../common/log/log";
import {GeneralMobilePlatform} from "../common/generalMobilePlatform";

export class NodeDebugWrapper {
    private projectRootPath: string;
    private remoteExtension: RemoteExtension;
    private telemetryReporter: ReassignableTelemetryReporter;
    private appName: string;
    private version: string;
    private mobilePlatformOptions: IRunOptions;

    private vscodeDebugAdapterPackage: typeof VSCodeDebugAdapter;
    private nodeDebugSession: typeof NodeDebugSession;
    private originalLaunchRequest: (response: any, args: any) => void;

    public constructor(appName: string, version: string, telemetryReporter: ReassignableTelemetryReporter, debugAdapter: typeof VSCodeDebugAdapter, debugSession: typeof NodeDebugSession) {
        this.appName = appName;
        this.version = version;
        this.telemetryReporter = telemetryReporter;
        this.vscodeDebugAdapterPackage = debugAdapter;
        this.nodeDebugSession = debugSession;
        this.originalLaunchRequest = this.nodeDebugSession.prototype.launchRequest;
    }

    /**
     * Calls customize methods for all requests needed
     */
    public customizeNodeAdapterRequests(): void {
        this.customizeLaunchRequest();
        this.customizeAttachRequest();
        this.customizeDisconnectRequest();
    }

    /**
     * Intecept the "launchRequest" instance method of NodeDebugSession to interpret arguments.
     * Launch should:
     * - Run the packager if needed
     * - Compile and run application
     * - Prewarm bundle
     */
    private customizeLaunchRequest(): void {
        const nodeDebugWrapper = this;
        this.nodeDebugSession.prototype.launchRequest = function (request: any, args: ILaunchRequestArgs) {
            nodeDebugWrapper.requestSetup(this, args);
            nodeDebugWrapper.mobilePlatformOptions.target = args.target || "simulator";
            nodeDebugWrapper.mobilePlatformOptions.iosRelativeProjectPath = !nodeDebugWrapper.isNullOrUndefined(args.iosRelativeProjectPath) ?
                args.iosRelativeProjectPath :
                IOSPlatform.DEFAULT_IOS_PROJECT_RELATIVE_PATH;

            // We add the parameter if it's defined (adapter crashes otherwise)
            if (!nodeDebugWrapper.isNullOrUndefined(args.logCatArguments)) {
                nodeDebugWrapper.mobilePlatformOptions.logCatArguments = [nodeDebugWrapper.parseLogCatArguments(args.logCatArguments)];
            }

            return TelemetryHelper.generate("launch", (generator) => {
                const resolver = new PlatformResolver();
                return nodeDebugWrapper.remoteExtension.getPackagerPort()
                    .then(packagerPort => {
                        nodeDebugWrapper.mobilePlatformOptions.packagerPort = packagerPort;
                        const mobilePlatform = resolver.resolveMobilePlatform(args.platform, nodeDebugWrapper.mobilePlatformOptions);
                        return Q({})
                            .then(() => {
                                generator.step("checkPlatformCompatibility");
                                TargetPlatformHelper.checkTargetPlatformSupport(nodeDebugWrapper.mobilePlatformOptions.platform);
                                generator.step("startPackager");
                                return mobilePlatform.startPackager();
                            })
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
                            .then(() =>
                                nodeDebugWrapper.attachRequest(this, request, args, mobilePlatform));
                    }).catch(error =>
                        nodeDebugWrapper.bailOut(this, error.message));
            });
        };
    }

    /**
     * Intecept the "attachRequest" instance method of NodeDebugSession to interpret arguments
     */
    private customizeAttachRequest(): void {
        const nodeDebugWrapper = this;
        this.nodeDebugSession.prototype.attachRequest = function (request: any, args: IAttachRequestArgs) {
            nodeDebugWrapper.requestSetup(this, args);
            nodeDebugWrapper.attachRequest(this, request, args, new GeneralMobilePlatform(nodeDebugWrapper.mobilePlatformOptions));
        };
    }

    /**
     * Intecept the "disconnectRequest" instance method of NodeDebugSession to interpret arguments
     */
    private customizeDisconnectRequest(): void {
        const originalRequest = this.nodeDebugSession.prototype.disconnectRequest;
        const nodeDebugWrapper = this;

        this.nodeDebugSession.prototype.disconnectRequest = function (response: any, args: any): void {
            // First we tell the extension to stop monitoring the logcat, and then we disconnect the debugging session

            if (nodeDebugWrapper.mobilePlatformOptions.platform === "android") {
                nodeDebugWrapper.remoteExtension.stopMonitoringLogcat()
                    .catch(reason =>
                        Log.logError(`WARNING: Couldn't stop monitoring logcat: ${reason.message || reason}\n`))
                    .finally(() =>
                        originalRequest.call(this, response, args));
            } else {
                originalRequest.call(this, response, args);
            }
        };
    }

    /**
     * Makes the required setup for request customization
     * - Enables telemetry
     * - Sets up mobilePlatformOptions, remote extension and projectRootPath
     * - Starts debug server
     * - Create global logger
     */
    private requestSetup(debugSession: NodeDebugSession, args: any) {
        this.projectRootPath = path.resolve(args.program, "../..");
        this.remoteExtension = RemoteExtension.atProjectRootPath(this.projectRootPath);
        this.mobilePlatformOptions = {
            projectRoot: this.projectRootPath,
            platform: args.platform,
        };

        // Start to send telemetry
        this.telemetryReporter.reassignTo(new ExtensionTelemetryReporter(
            this.appName, this.version, Telemetry.APPINSIGHTS_INSTRUMENTATIONKEY, this.projectRootPath));

        // Create a server waiting for messages to re-initialize the debug session;
        const debugServerListeningPort = this.createReinitializeServer(debugSession, args.internalDebuggerPort);
        args.args = [debugServerListeningPort.toString()];

        Log.SetGlobalLogger(new NodeDebugAdapterLogger(this.vscodeDebugAdapterPackage, debugSession));
    }

    /**
     * Runs logic needed to attach.
     * Attach should:
     * - Enable js debugging
     */
    private attachRequest(debugSession: NodeDebugSession, request: any, args: any, mobilePlatform: any): Q.Promise<void> {
        return TelemetryHelper.generate("attach", (generator) => {
            return Q({})
                .then(() => {
                    generator.step("mobilePlatform.enableJSDebuggingMode");
                    if (mobilePlatform) {
                        return mobilePlatform.enableJSDebuggingMode();
                    } else {
                        Log.logMessage("Debugger ready. Enable remote debugging in app.");
                    }
                }).then(() =>
                    this.originalLaunchRequest.call(debugSession, request, args))
                .catch(error =>
                    this.bailOut(debugSession, error.message));
        });
    }

    /**
     * Creates internal debug server and returns the port that the server is hook up into.
     */
    private createReinitializeServer(debugSession: NodeDebugSession, internalDebuggerPort: string): number {
        // Create the server
        const server = http.createServer((req, res) => {
            res.statusCode = 404;
            if (req.url === "/refreshBreakpoints") {
                res.statusCode = 200;
                if (debugSession) {
                    const sourceMaps = debugSession._sourceMaps;
                    if (sourceMaps) {
                        // Flush any cached source maps
                        sourceMaps._allSourceMaps = {};
                        sourceMaps._generatedToSourceMaps = {};
                        sourceMaps._sourceToGeneratedMaps = {};
                    }
                    // Send an "initialized" event to trigger breakpoints to be re-sent
                    debugSession.sendEvent(new this.vscodeDebugAdapterPackage.InitializedEvent());
                }
            }
            res.end();
        });

        // Setup listen port and on error response
        const port = parseInt(internalDebuggerPort, 10) || 9090;

        server.listen(port);
        server.on("error", (err: Error) => {
            TelemetryHelper.sendSimpleEvent("reinitializeServerError");
            Log.logError("Error in debug adapter server: " + err.toString());
            Log.logMessage("Breakpoints may not update. Consider restarting and specifying a different 'internalDebuggerPort' in launch.json");
        });

        // Return listen port
        return port;
    }

    /**
     * Logs error to user and finishes the debugging process.
     */
    private bailOut(debugSession: NodeDebugSession, message: string): void {
        Log.logError(`Could not debug. ${message}`);
        debugSession.sendEvent(new this.vscodeDebugAdapterPackage.TerminatedEvent());
        process.exit(1);
    }

    /**
     * Parses log cat arguments to a string
     */
    private parseLogCatArguments(userProvidedLogCatArguments: any): string {
        return Array.isArray(userProvidedLogCatArguments)
            ? userProvidedLogCatArguments.join(" ") // If it's an array, we join the arguments
            : userProvidedLogCatArguments; // If not, we leave it as-is
    }

    /**
     * Helper method to know if a value is either null or undefined
     */
    private isNullOrUndefined(value: any): boolean {
        return typeof value === "undefined" || value === null;
    }
}