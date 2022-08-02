// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.

import { Connection } from "vscode-cdp-proxy";
import { ICDPMessageHandler, ProcessedCDPMessage } from "./ICDPMessageHandler";

export abstract class BaseCDPMessageHandler implements ICDPMessageHandler {
    protected debuggerTarget: Connection | null;
    protected applicationTarget: Connection | null;

    public processDebuggerCDPMessage(event: any): ProcessedCDPMessage {
        return {
            event,
            sendBack: false,
        };
    }

    public processApplicationCDPMessage(event: any): ProcessedCDPMessage {
        return {
            event,
            sendBack: false,
        };
    }

    public setDebuggerTarget(debuggerTarget: Connection | null): void {
        this.debuggerTarget = debuggerTarget;
    }

    public setApplicationTarget(applicationTarget: Connection | null): void {
        this.applicationTarget = applicationTarget;
    }
}
