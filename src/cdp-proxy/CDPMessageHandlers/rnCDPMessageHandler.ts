// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.

import {
    IProtocolCommand
} from "vscode-cdp-proxy";
import { ICDPMessageHandler, ProtocolMessage } from "./ICDPMessageHandler";


export class RnCDPMessageHandler implements ICDPMessageHandler {
    private firstStop: boolean;

    constructor() {
        this.firstStop = true;
    }

    public processCDPMessage(evt: any): ProtocolMessage {
        if (evt.method === "Debugger.paused" && this.firstStop) {
            evt.params = this.handleAppBundleFirstPauseEvent(evt);
        } else if (evt.method === "close") {
            this.handleDebuggerDisconnect();
        }

        return evt;
    }

    /** Since the bundle runs inside the Node.js VM in `debuggerWorker.js` in runtime
     *  Node debug adapter need time to parse new added code source maps
     *  So we added `debugger;` statement at the start of the bundle code
     *  and wait for the adapter to receive a signal to stop on that statement
     *  and then change pause reason to `Break on start` so js-debug can process all breakpoints in the bundle and
     *  continue the code execution using `continueOnAttach` flag
     */
    private handleAppBundleFirstPauseEvent(evt: IProtocolCommand): any {
        let params: any = evt.params;
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
