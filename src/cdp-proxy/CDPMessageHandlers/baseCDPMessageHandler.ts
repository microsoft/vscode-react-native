// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.

import { ICDPMessageHandler, ProcessedCDPMessage } from "./ICDPMessageHandler";

export abstract class BaseCDPMessageHandler implements ICDPMessageHandler {
    constructor() {}

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
}