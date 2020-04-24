// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.

import { ICDPMessageHandler, ProtocolMessage } from "./ICDPMessageHandler";

export class DirectCDPMessageHandler implements ICDPMessageHandler {

    constructor() { }

    public processCDPMessage(evt: any): ProtocolMessage {
        return evt;
    }
}