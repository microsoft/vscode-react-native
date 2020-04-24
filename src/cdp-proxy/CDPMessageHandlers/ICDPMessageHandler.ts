// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.

import {
    IProtocolCommand,
    IProtocolSuccess,
    IProtocolError
} from "vscode-cdp-proxy";

export declare type ProtocolMessage = IProtocolCommand | IProtocolSuccess | IProtocolError;

export interface ICDPMessageHandler {
    processDebuggerCDPMessage: (evt: any) => ProtocolMessage;
    processApplicationCDPMessage: (evt: any) => ProtocolMessage;
}
