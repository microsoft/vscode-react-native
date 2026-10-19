// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.

import { IProtocolCommand, IProtocolSuccess } from "vscode-cdp-proxy";
import { BaseCDPMessageHandler } from "./baseCDPMessageHandler";
import { ProcessedCDPMessage, ProtocolMessage } from "./ICDPMessageHandler";
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

    public processDebuggerCDPMessage(event: ProtocolMessage): ProcessedCDPMessage {
        const sendBack = false;
        if (
            !this.isBackcompatConfigured &&
            "method" in event &&
            event.method === CDP_API_NAMES.RUNTIME_ENABLE
        ) {
            this.configureTargetForIWDPCommunication();
            this.configureDebuggerForIWDPCommunication();
            this.isBackcompatConfigured = true;
        }
        return {
            event,
            sendBack,
        };
    }

    public processApplicationCDPMessage(event: ProtocolMessage): ProcessedCDPMessage {
        let processedEvent: ProtocolMessage = event;
        if (
            "method" in event &&
            "params" in event &&
            event.method === CDP_API_NAMES.CONSOLE_MESSAGE_ADDED
        ) {
            processedEvent = this.processDeprecatedConsoleMessage(event);
        }
        if ("result" in processedEvent && processedEvent.result) {
            const result = processedEvent.result as { properties?: unknown };
            if (result.properties) {
                (processedEvent as IProtocolSuccess).result = { result: result.properties };
            }
        }
        return {
            event: processedEvent,
            sendBack: false,
        };
    }

    private processDeprecatedConsoleMessage(event: IProtocolCommand): IProtocolCommand {
        const params = event.params as {
            message: {
                type: unknown;
                timestamp: unknown;
                parameters?: unknown;
                text: unknown;
                stack?: unknown;
                stackTrace?: unknown;
            };
        };
        const message = params.message;
        return {
            method: CDP_API_NAMES.RUNTIME_CONSOLE_API_CALLED,
            params: {
                type: message.type,
                timestamp: message.timestamp,
                args: message.parameters || [{ type: "string", value: message.text }],
                stackTrace: {
                    callFrames: message.stack || message.stackTrace,
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
        params: object = {},
        addMessageId: boolean = true,
    ): void {
        const request: IProtocolCommand = {
            method,
            params,
        };

        if (addMessageId) {
            request.id = this.customMessageLastId++;
        }

        this.debuggerTarget?.send(request);
    }
}
