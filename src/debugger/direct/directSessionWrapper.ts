// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.

import { ChromeDebugSession, IChromeDebugSessionOpts } from "vscode-chrome-debug-core";
import { ReassignableTelemetryReporter } from "../../common/telemetryReporters";

export function makeDirectSession(
    debugSessionOpts: IChromeDebugSessionOpts,
    telemetryReporter: ReassignableTelemetryReporter
    ): typeof ChromeDebugSession {

    return class extends ChromeDebugSession {

        private telemetryReporter: ReassignableTelemetryReporter;

        constructor(debuggerLinesAndColumnsStartAt1?: boolean, isServer?: boolean) {
            super(debuggerLinesAndColumnsStartAt1, isServer, debugSessionOpts);
            this.telemetryReporter = telemetryReporter;
        }

        public getTelemetryReporter(): ReassignableTelemetryReporter {
            return this.telemetryReporter;
        }
    };
}
