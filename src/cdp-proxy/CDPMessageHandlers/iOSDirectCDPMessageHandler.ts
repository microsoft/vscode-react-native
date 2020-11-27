// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.

import { BaseCDPMessageHandler } from "./baseCDPMessageHandler";
import { ProcessedCDPMessage } from "./ICDPMessageHandler";
import { CDP_API_NAMES } from "./CDPAPINames";

export class IOSDirectCDPMessageHandler extends BaseCDPMessageHandler {
    private isBackcompatConfigured: boolean;

    constructor() {
        super();
        this.isBackcompatConfigured = false;
    }

    public processDebuggerCDPMessage(event: any): ProcessedCDPMessage {
        let sendBack = false;
        if (!this.isBackcompatConfigured && event.method === CDP_API_NAMES.RUNTIME_ENABLE) {
            this.configureTargetForIWDPCommunication();
        }
        return {
            event,
            sendBack,
        };
    }

    public processApplicationCDPMessage(event: any): ProcessedCDPMessage {
        if (event.method === CDP_API_NAMES.CONSOLE_MESSAGE_ADDED) {
            event = this.processDeprecatedConsoleMessage(event);
        }
        if (event.result && event.result.properties) {
            event.result = { result: event.result.properties };
        }
        return {
            event,
            sendBack: false,
        };
    }

    private processDeprecatedConsoleMessage(event: any) {
        return {
            method: CDP_API_NAMES.RUNTIME_CONSOLE_API_CALLED,
            params: {
                type: event.params.message.type,
                timestamp: event.params.message.timestamp,
                args: event.params.message.parameters || [
                    { type: "string", value: event.params.message.text },
                ],
                stackTrace: {
                    callFrames: event.params.message.stack || event.params.message.stackTrace,
                },
                executionContextId: 1,
            },
        };
    }

    private configureTargetForIWDPCommunication(): void {
        this.isBackcompatConfigured = true;
        try {
            this.applicationTarget?.api.Console.enable({});
            this.applicationTarget?.api.Debugger.setBreakpointsActive({ active: true });
        } catch (err) {
            // Specifically ignore a fail here since it's only for backcompat
        }
    }
}
