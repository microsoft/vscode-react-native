// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.

import * as fs from "fs";
import * as path from "path";
import * as http from "http";

import {Telemetry} from "../common/telemetry";
import {TelemetryHelper} from "../common/telemetryHelper";
import {RemoteExtension} from "../common/remoteExtension";
import {EntryPointHandler, ProcessType} from "../common/entryPointHandler";
import {ErrorHelper} from "../common/error/errorHelper";
import {InternalErrorCode} from "../common/error/internalErrorCode";
import {IOSPlatform} from "./ios/iOSPlatform";
import {ExtensionTelemetryReporter, NullTelemetryReporter, ReassignableTelemetryReporter} from "../common/telemetryReporters";

// These typings do not reflect the typings as intended to be used
// but rather as they exist in truth, so we can reach into the internals
// and access what we need.
declare module VSCodeDebugAdapter {
    class DebugSession {
        public static run: Function;
        public sendEvent(event: VSCodeDebugAdapter.InitializedEvent): void;
        public start(input: any, output: any): void;
        public launchRequest(response: any, args: any): void;
        public disconnectRequest(response: any, args: any): void;
    }
    class InitializedEvent {
        constructor();
    }
    class OutputEvent {
        constructor(message: string, destination?: string);
    }
    class TerminatedEvent {
        constructor();
    }
}

declare class SourceMaps {
    public _sourceToGeneratedMaps: {};
    public _generatedToSourceMaps: {};
    public _allSourceMaps: {};
}

declare class NodeDebugSession extends VSCodeDebugAdapter.DebugSession {
    public _sourceMaps: SourceMaps;
}

interface ILaunchArgs {
    platform: string;
    target?: string;
    internalDebuggerPort?: any;
    iosRelativeProjectPath?: string;
    args: string[];
    logCatArguments: any;
    program: string;
}

let version = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "..", "package.json"), "utf-8")).version;

function bailOut(reason: string): void {
    // Things have gone wrong in initialization: Report the error to telemetry and exit
    TelemetryHelper.sendSimpleEvent(reason);
    process.exit(1);
}

function parseLogCatArguments(userProvidedLogCatArguments: any) {
    return Array.isArray(userProvidedLogCatArguments)
        ? userProvidedLogCatArguments.join(" ") // If it's an array, we join the arguments
        : userProvidedLogCatArguments; // If not, we leave it as-is
}

function isNullOrUndefined(value: any): boolean {
    return typeof value === "undefined" || value === null;
}

let projectRootPath: string = null;

// Enable telemetry
const telemetryReporter = new ReassignableTelemetryReporter(new NullTelemetryReporter());
const appName = "react-native-debug-adapter";
new EntryPointHandler(ProcessType.Debugger).runApp(appName, () => version,
    ErrorHelper.getInternalError(InternalErrorCode.DebuggingFailed), telemetryReporter, () => {
        let nodeDebugFolder: string;
        let vscodeDebugAdapterPackage: typeof VSCodeDebugAdapter;

        // nodeDebugLocation.json is dynamically generated on extension activation.
        // If it fails, we must not have been in a react native project
        try {
            /* tslint:disable:no-var-requires */
            nodeDebugFolder = require("./nodeDebugLocation.json").nodeDebugPath;
            vscodeDebugAdapterPackage = require(path.join(nodeDebugFolder, "node_modules", "vscode-debugadapter"));
            /* tslint:enable:no-var-requires */
        } catch (e) {
            // Nothing we can do here: can't even communicate back because we don't know how to speak debug adapter
            bailOut("cannotFindDebugAdapter");
        }

        // Temporarily dummy out the DebugSession.run function so we do not start the debug adapter until we are ready
        const originalDebugSessionRun = vscodeDebugAdapterPackage.DebugSession.run;
        vscodeDebugAdapterPackage.DebugSession.run = function() { };

        let nodeDebug: { NodeDebugSession: typeof NodeDebugSession };

        try {
            /* tslint:disable:no-var-requires */
            nodeDebug = require(path.join(nodeDebugFolder, "out", "node", "nodeDebug"));
            /* tslint:enable:no-var-requires */
        } catch (e) {
            // Unable to find nodeDebug, but we can make our own communication channel now
            const debugSession = new vscodeDebugAdapterPackage.DebugSession();
            // Note: this will not work in the context of debugging the debug adapter and communicating over a socket,
            // but in that case we have much better ways to investigate errors.
            debugSession.start(process.stdin, process.stdout);
            debugSession.sendEvent(new vscodeDebugAdapterPackage.OutputEvent("Unable to start debug adapter: " + e.toString(), "stderr"));
            debugSession.sendEvent(new vscodeDebugAdapterPackage.TerminatedEvent());

            bailOut("cannotFindNodeDebugAdapter");
        }

        vscodeDebugAdapterPackage.DebugSession.run = originalDebugSessionRun;

        // Intecept the "launchRequest" instance method of NodeDebugSession to interpret arguments
        const originalNodeDebugSessionLaunchRequest = nodeDebug.NodeDebugSession.prototype.launchRequest;
        nodeDebug.NodeDebugSession.prototype.launchRequest = function(request: any, args: ILaunchArgs) {
            projectRootPath = path.resolve(args.program, "../..");
            telemetryReporter.reassignTo(new ExtensionTelemetryReporter( // We start to send telemetry
                appName, version, Telemetry.APPINSIGHTS_INSTRUMENTATIONKEY, projectRootPath));

            // Create a server waiting for messages to re-initialize the debug session;
            const reinitializeServer = http.createServer((req, res) => {
                res.statusCode = 404;
                if (req.url === "/refreshBreakpoints") {
                    res.statusCode = 200;
                    if (this) {
                        const sourceMaps = this._sourceMaps;
                        if (sourceMaps) {
                            // Flush any cached source maps
                            sourceMaps._allSourceMaps = {};
                            sourceMaps._generatedToSourceMaps = {};
                            sourceMaps._sourceToGeneratedMaps = {};
                        }
                        // Send an "initialized" event to trigger breakpoints to be re-sent
                        this.sendEvent(new vscodeDebugAdapterPackage.InitializedEvent());
                    }
                }
                res.end();
            });
            const debugServerListeningPort = parseInt(args.internalDebuggerPort, 10) || 9090;


            reinitializeServer.listen(debugServerListeningPort);
            reinitializeServer.on("error", (err: Error) => {
                TelemetryHelper.sendSimpleEvent("reinitializeServerError");
                this.sendEvent(new vscodeDebugAdapterPackage.OutputEvent("Error in debug adapter server: " + err.toString(), "stderr"));
                this.sendEvent(new vscodeDebugAdapterPackage.OutputEvent("Breakpoints may not update. Consider restarting and specifying a different 'internalDebuggerPort' in launch.json"));
            });

            // We do not permit arbitrary args to be passed to our process
            args.args = [
                args.platform,
                debugServerListeningPort.toString(),
                !isNullOrUndefined(args.iosRelativeProjectPath) ? args.iosRelativeProjectPath : IOSPlatform.DEFAULT_IOS_PROJECT_RELATIVE_PATH,
                args.target || "simulator",
            ];

            if (!isNullOrUndefined(args.logCatArguments)) { // We add the parameter if it's defined (adapter crashes otherwise)
                args.args = args.args.concat([parseLogCatArguments(args.logCatArguments)]);
            }

            originalNodeDebugSessionLaunchRequest.call(this, request, args);
        };

        // Intecept the "launchRequest" instance method of NodeDebugSession to interpret arguments
        const originalNodeDebugSessionDisconnectRequest = nodeDebug.NodeDebugSession.prototype.disconnectRequest;
        function customDisconnectRequest(response: any, args: any): void {
            try {
                // First we tell the extension to stop monitoring the logcat, and then we disconnect the debugging session
                const remoteExtension = RemoteExtension.atProjectRootPath(projectRootPath);
                remoteExtension.stopMonitoringLogcat()
                    .finally(() => originalNodeDebugSessionDisconnectRequest.call(this, response, args))
                    .done(() => { }, reason => // We just print a warning if something fails
                        process.stderr.write(`WARNING: Couldn't stop monitoring logcat: ${reason.message || reason}\n`));
            } catch (exception) {
                // This is a "nice to have" feature, so we just fire the message and forget. We don't event handle
                // errors in the response promise
                process.stderr.write(`WARNING: Couldn't stop monitoring logcat. Sync exception: ${exception.message || exception}\n`);
                originalNodeDebugSessionDisconnectRequest.call(this, response, args);
            }
        }
        nodeDebug.NodeDebugSession.prototype.disconnectRequest = customDisconnectRequest;

        vscodeDebugAdapterPackage.DebugSession.run(nodeDebug.NodeDebugSession);
    });
