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
    }
    class InitializedEvent {
        // Nothing relevant
    }
}

declare class SourceMaps {
    public _sourceToGeneratedMaps: {};
    public _generatedToSourceMaps: {};
    public _allSourceMaps: {};
}

declare class NodeDebugSession {
    public _sourceMaps: SourceMaps;
    public sendEvent(event: VSCodeDebugAdapter.InitializedEvent): void;
    public start(): any;
}

/* tslint:disable:no-var-requires */

// nodeDebugLocation.json is dynamically generated on extension activation.
// If it fails, we must not have been in a react native project
const nodeDebugFolder = require("./nodeDebugLocation.json").nodeDebugPath;

const vscodeDebugAdapterPackage: typeof VSCodeDebugAdapter = require(path.join(nodeDebugFolder, "node_modules", "vscode-debugadapter"));

// Temporarily dummy out the DebugSession.run function so we do not start the debug adapter until we are ready
const originalDebugSessionRun = vscodeDebugAdapterPackage.DebugSession.run;
vscodeDebugAdapterPackage.DebugSession.run = function () {};

const nodeDebug: {NodeDebugSession: typeof NodeDebugSession} = require(path.join(nodeDebugFolder, "out", "node", "nodeDebug"));

/* tslint:enable:no-var-requires */

vscodeDebugAdapterPackage.DebugSession.run = originalDebugSessionRun;

// Intercept the "start" instance method of NodeDebugSession to keep a reference to the instance itself
let nodeDebugSession: NodeDebugSession;
const originalNodeDebugSessionStart = nodeDebug.NodeDebugSession.prototype.start;
nodeDebug.NodeDebugSession.prototype.start = function () {
    nodeDebugSession = this;
    return originalNodeDebugSessionStart.apply(this, arguments);
};

// Create a server waiting for messages to re-initialize the debug session;
const reinitializeServer = http.createServer((request, response) => {
    if (nodeDebugSession) {
        const sourceMaps = nodeDebugSession._sourceMaps;
        if (sourceMaps) {
            // Flush any cached source maps
            sourceMaps._allSourceMaps = {};
            sourceMaps._generatedToSourceMaps = {};
            sourceMaps._sourceToGeneratedMaps = {};
        }
        // Send an "initialized" event to trigger breakpoints to be re-sent
        nodeDebugSession.sendEvent(new vscodeDebugAdapterPackage.InitializedEvent());
    }
    response.end();
});

// Determine which port to listen on:
const ourDebugPortIndexSentinel = process.argv.indexOf("--reactNativeDebuggerPort");
const debugServerListeningPort = parseInt(process.argv[ourDebugPortIndexSentinel + 1], 10) || 8080;

reinitializeServer.listen(debugServerListeningPort);

// Launch the modified debug adapter
vscodeDebugAdapterPackage.DebugSession.run(nodeDebug.NodeDebugSession);