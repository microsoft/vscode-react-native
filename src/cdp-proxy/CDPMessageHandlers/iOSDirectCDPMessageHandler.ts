// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.

import { BaseCDPMessageHandler } from "./baseCDPMessageHandler";
import { ProcessedCDPMessage } from "./ICDPMessageHandler";
import { CDP_API_NAMES } from "./CDPAPINames";

interface ExecutionContext {
    id: number;
    origin: string;
    name: string;
    auxData?: {
        isDefault: boolean;
        type?: "default" | "page";
        frameId?: string;
    };
}

export class IOSDirectCDPMessageHandler extends BaseCDPMessageHandler {
    private isBackcompatConfigured: boolean;
    private customMessageLastId: number;

    constructor() {
        super();
        this.isBackcompatConfigured = false;
        this.customMessageLastId = 0;
    }

    public processDebuggerCDPMessage(event: any): ProcessedCDPMessage {
        const sendBack = false;
        if (!this.isBackcompatConfigured && event.method === CDP_API_NAMES.RUNTIME_ENABLE) {
            this.configureTargetForIWDPCommunication();
            this.configureDebuggerForIWDPCommunication();
            this.isBackcompatConfigured = true;
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
        try {
            this.applicationTarget?.api.Console.enable({});
            this.applicationTarget?.api.Debugger.setBreakpointsActive({ active: true });
        } catch (err) {
            // Specifically ignore a fail here since it's only for backcompat
        }
    }

    private configureDebuggerForIWDPCommunication(): void {
        const context: ExecutionContext = {
            id: this.customMessageLastId++,
            origin: "",
            name: "IOS Execution Context",
            auxData: {
                isDefault: true,
            },
        };
        try {
            this.sendCustomRequestToDebuggerTarget(
                CDP_API_NAMES.EXECUTION_CONTEXT_CREATED,
                { context },
                false,
            );
        } catch (err) {
            throw Error("Could not create Execution context");
        }
    }

    private sendCustomRequestToDebuggerTarget(
        method: string,
        params: any = {},
        addMessageId: boolean = true,
    ): void {
        const request: any = {
            method,
            params,
        };

        if (addMessageId) {
            request.id = this.customMessageLastId++;
        }

        this.debuggerTarget?.send(request);
    }
}
