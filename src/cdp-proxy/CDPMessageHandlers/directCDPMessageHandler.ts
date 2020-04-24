// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.

// import { IProtocolCommand } from "vscode-cdp-proxy";
import { ICDPMessageHandler, ProtocolMessage } from "./ICDPMessageHandler";

export class DirectCDPMessageHandler implements ICDPMessageHandler {

    constructor() { }

    public processDebuggerCDPMessage(evt: any): ProtocolMessage {
        if (evt.method === "Debugger.setBreakpoint") {
            evt = this.handleBreakpointSetting(evt);
        }

        return evt;
    }

    public processApplicationCDPMessage(evt: any): ProtocolMessage {
        return evt;
    }

    private handleBreakpointSetting(evt: any) {
        if (evt.params) {
            delete evt.params.location.columnNumber;
        }
        return evt;
    }
}