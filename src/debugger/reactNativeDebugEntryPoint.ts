// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.

import * as fs from "fs";
import * as path from "path";

import {TelemetryHelper} from "../common/telemetryHelper";
import {EntryPointHandler, ProcessType} from "../common/entryPointHandler";
import {ErrorHelper} from "../common/error/errorHelper";
import {InternalErrorCode} from "../common/error/internalErrorCode";
import {NullTelemetryReporter, ReassignableTelemetryReporter} from "../common/telemetryReporters";
import {NodeDebugWrapper} from "./nodeDebugWrapper";

const version = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "..", "package.json"), "utf-8")).version;
const telemetryReporter = new ReassignableTelemetryReporter(new NullTelemetryReporter());
const appName = "react-native-debug-adapter";

function bailOut(reason: string): void {
    // Things have gone wrong in initialization: Report the error to telemetry and exit
    TelemetryHelper.sendSimpleEvent(reason);
    process.exit(1);
}

// Enable telemetry
new EntryPointHandler(ProcessType.Debugger).runApp(appName, () => version,
    ErrorHelper.getInternalError(InternalErrorCode.DebuggingFailed), telemetryReporter, () => {

        /**
         * For debugging React Native we basically want to debug node plus some other stuff.
         * There is no need to create a new adapter for node because ther already exists one.
         * We look for node debug adapter on client's computer so we can jump of on top of that.
         */
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

        /**
         * We did find node debug adapter. Lets get the debugSession from it.
         * And add our customizations to the requests.
         */

        // Temporarily dummy out the DebugSession.run function so we do not start the debug adapter until we are ready
        const originalDebugSessionRun = vscodeDebugAdapterPackage.DebugSession.run;
        vscodeDebugAdapterPackage.DebugSession.run = () => { };

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

        // Customize node adapter requests
        try {
            let nodeDebugWrapper = new NodeDebugWrapper(appName, version, telemetryReporter, vscodeDebugAdapterPackage, nodeDebug.NodeDebugSession);
            nodeDebugWrapper.customizeNodeAdapterRequests();
        } catch (e) {
            const debugSession = new vscodeDebugAdapterPackage.DebugSession();
            debugSession.sendEvent(new vscodeDebugAdapterPackage.OutputEvent("Unable to start debug adapter: " + e.toString(), "stderr"));
            debugSession.sendEvent(new vscodeDebugAdapterPackage.TerminatedEvent());
            bailOut(e.toString());
        }

        // Run the debug session for the node debug adapter with our modified requests
        vscodeDebugAdapterPackage.DebugSession.run(nodeDebug.NodeDebugSession);
    });