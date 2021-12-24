// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.

import { IProtocolCommand } from "vscode-cdp-proxy";
import { ProcessedCDPMessage } from "./ICDPMessageHandler";
import { CDP_API_NAMES } from "./CDPAPINames";
import { BaseCDPMessageHandler } from "./baseCDPMessageHandler";

export class RnCDPMessageHandler extends BaseCDPMessageHandler {
    private firstStop: boolean;

    constructor() {
        super();
        this.firstStop = true;
    }

    public processDebuggerCDPMessage(event: any): ProcessedCDPMessage {
        const sendBack = false;
        if (event.method === CDP_API_NAMES.CLOSE) {
            this.handleDebuggerDisconnect();
        }

        return {
            event,
            sendBack,
        };
    }

    public processApplicationCDPMessage(event: any): ProcessedCDPMessage {
        const sendBack = false;
        if (event.method === CDP_API_NAMES.DEBUGGER_PAUSED && this.firstStop) {
            event.params = this.handleAppBundleFirstPauseEvent(event);
        }

        return {
            event,
            sendBack,
        };
    }

    /** Since the bundle runs inside the Node.js VM in `debuggerWorker.js` in runtime
     *  Node debug adapter need time to parse new added code source maps
     *  So we added `debugger;` statement at the start of the bundle code
     *  and wait for the adapter to receive a signal to stop on that statement
     *  and then change pause reason to `Break on start` so js-debug can process all breakpoints in the bundle and
     *  continue the code execution using `continueOnAttach` flag
     */
    private handleAppBundleFirstPauseEvent(event: IProtocolCommand): any {
        const params: any = event.params;
        if (params.reason && params.reason === "other") {
            this.firstStop = false;
            params.reason = "Break on start";
        }
        return params;
    }

    private handleDebuggerDisconnect() {
        this.firstStop = true;
    }
}
