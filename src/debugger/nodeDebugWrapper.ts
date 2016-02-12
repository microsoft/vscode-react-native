// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.

import * as path from "path";
import * as http from "http";

// These typings do not reflect the typings as intended to be used
// but rather as they exist in truth, so we can reach into the internals
// and access what we need.
declare module VSCodeDebugAdapter {
    class DebugSession {
        public static run: Function;
        public sendEvent(event: VSCodeDebugAdapter.InitializedEvent): void;
        public start(input: any, output: any): void;
        public launchRequest(response: any, args: any): void;
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
    args: string[];
}

let nodeDebugFolder: string;
let vscodeDebugAdapterPackage: typeof VSCodeDebugAdapter;

/* tslint:disable:no-var-requires */

// nodeDebugLocation.json is dynamically generated on extension activation.
// If it fails, we must not have been in a react native project
try {
    nodeDebugFolder = require("./nodeDebugLocation.json").nodeDebugPath;

    vscodeDebugAdapterPackage = require(path.join(nodeDebugFolder, "node_modules", "vscode-debugadapter"));
} catch (e) {
    // Nothing we can do here: can't even communicate back because we don't know how to speak debug adapter
    process.exit(1);
}

// Temporarily dummy out the DebugSession.run function so we do not start the debug adapter until we are ready
const originalDebugSessionRun = vscodeDebugAdapterPackage.DebugSession.run;
vscodeDebugAdapterPackage.DebugSession.run = function() { };

let nodeDebug: { NodeDebugSession: typeof NodeDebugSession };

try {
    nodeDebug = require(path.join(nodeDebugFolder, "out", "node", "nodeDebug"));
} catch (e) {
    // Unable to find nodeDebug, but we can make our own communication channel now
    const debugSession = new vscodeDebugAdapterPackage.DebugSession();
    // Note: this will not work in the context of debugging the debug adapter and communicating over a socket,
    // but in that case we have much better ways to investigate errors.
    debugSession.start(process.stdin, process.stdout);
    debugSession.sendEvent(new vscodeDebugAdapterPackage.OutputEvent("Unable to start debug adapter: " + e.toString(), "stderr"));
    debugSession.sendEvent(new vscodeDebugAdapterPackage.TerminatedEvent());
    process.exit(1);
}

/* tslint:enable:no-var-requires */

vscodeDebugAdapterPackage.DebugSession.run = originalDebugSessionRun;

// Intecept the "launchRequest" instance method of NodeDebugSession to interpret arguments
const originalNodeDebugSessionLaunchRequest = nodeDebug.NodeDebugSession.prototype.launchRequest;
nodeDebug.NodeDebugSession.prototype.launchRequest = function(request: any, args: ILaunchArgs) {
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
        this.sendEvent(new vscodeDebugAdapterPackage.OutputEvent("Error in debug adapter server: " + err.toString(), "stderr"));
        this.sendEvent(new vscodeDebugAdapterPackage.OutputEvent("Breakpoints may not update. Consider restarting and specifying a different 'internalDebuggerPort' in launch.json"));
    });

    // We do not permit arbitrary args to be passed to our process
    args.args = [
        args.platform,
        debugServerListeningPort.toString(),
        args.target || "simulator"
    ];

    originalNodeDebugSessionLaunchRequest.call(this, request, args);
};

// Launch the modified debug adapter
vscodeDebugAdapterPackage.DebugSession.run(nodeDebug.NodeDebugSession);