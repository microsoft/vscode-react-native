// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.

import * as fs from "fs";
import * as path from "path";

import {TelemetryHelper} from "../common/telemetryHelper";
import {EntryPointHandler, ProcessType} from "../common/entryPointHandler";
import {ErrorHelper} from "../common/error/errorHelper";
import {InternalErrorCode} from "../common/error/internalErrorCode";
import {NullTelemetryReporter, ReassignableTelemetryReporter} from "../common/telemetryReporters";

import { createAdapter } from "./nodeDebugWrapper";

const version = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "..", "package.json"), "utf-8")).version;
const telemetryReporter = new ReassignableTelemetryReporter(new NullTelemetryReporter());
const extensionName = "react-native-debug-adapter";

function bailOut(reason: string): void {
    // Things have gone wrong in initialization: Report the error to telemetry and exit
    TelemetryHelper.sendSimpleEvent(reason);
    process.exit(1);
}

// Enable telemetry
new EntryPointHandler(ProcessType.Debugger).runApp(extensionName, () => version,
    ErrorHelper.getInternalError(InternalErrorCode.DebuggingFailed), telemetryReporter, () => {

        /**
         * For debugging React Native we basically want to debug node plus some other stuff.
         * There is no need to create a new adapter for node because ther already exists one.
         * We look for node debug adapter on client's computer so we can jump of on top of that.
         */
        let nodeDebugFolder: string;
        let VSCodeDebugAdapter: typeof VSCodeDebugAdapterPackage;
        let Node2DebugAdapter: typeof Node2DebugAdapterPackage.Node2DebugAdapter;
        let ChromeDebugSession: typeof ChromeDebuggerCorePackage.ChromeDebugSession;

        // nodeDebugLocation.json is dynamically generated on extension activation.
        // If it fails, we must not have been in a react native project
        try {
            /* tslint:disable:no-var-requires */
            // nodeDebugFolder = require("./nodeDebugLocation.json").nodeDebugPath;
            nodeDebugFolder = "/Applications/Visual Studio Code.app/Contents/Resources/app/extensions/ms-vscode.node-debug2";
            VSCodeDebugAdapter = require(path.join(nodeDebugFolder, "node_modules/vscode-debugadapter"));
            ChromeDebugSession = require(path.join(nodeDebugFolder, "node_modules/vscode-chrome-debug-core")).ChromeDebugSession;
            Node2DebugAdapter = require(path.join(nodeDebugFolder, "out/src/nodeDebugAdapter")).NodeDebugAdapter;
            /* tslint:enable:no-var-requires */
        } catch (e) {
            // Nothing we can do here: can't even communicate back because we don't know how to speak debug adapter
            bailOut("cannotFindDebugAdapter");
        }

        /**
         * We did find node debug adapter. Lets get the debugSession from it.
         * And add our customizations to the requests.
         */

        let adapter: typeof ChromeDebuggerCorePackage.ChromeDebugAdapter;
        // Customize node adapter requests
        try {
            // Create customised react-native debug adapter based on Node-debug2 adapter
            adapter = createAdapter(Node2DebugAdapter, VSCodeDebugAdapter);
        } catch (e) {
            const debugSession = new ChromeDebugSession();
            debugSession.sendEvent(new VSCodeDebugAdapter.OutputEvent("Unable to start debug adapter: " + e.toString(), "stderr"));
            debugSession.sendEvent(new VSCodeDebugAdapter.TerminatedEvent());
            bailOut(e.toString());
        }

        // Create a debug session class based on ChromeDebugSession
        const ReactNativeDebugSession = class extends ChromeDebugSession {
            protected appName: string = extensionName;
            protected version: string = version;

            constructor(debuggerLinesAndColumnsStartAt1?: boolean, isServer?: boolean) {
                super(debuggerLinesAndColumnsStartAt1, isServer, {
                    logFilePath: path.join(`/Users/kotikov.vladimir/${extensionName}.log`),
                    adapter,
                    extensionName,
                });
            }
        };

        // Run the debug session for the node debug adapter with our modified requests
        ChromeDebugSession.run(ReactNativeDebugSession);
    });
