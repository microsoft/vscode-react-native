// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.

import { ICDPMessageHandler, ProcessedCDPMessage } from "./ICDPMessageHandler";

export class IOSDirectCDPMessageHandler implements ICDPMessageHandler {
    public processDebuggerCDPMessage(event: any): ProcessedCDPMessage {
        let sendBack = false;

        return {
            event,
            sendBack,
        };
    }

    public processApplicationCDPMessage(event: any): ProcessedCDPMessage {
        let sendBack = false;

        return {
            event,
            sendBack,
        };
    }
}