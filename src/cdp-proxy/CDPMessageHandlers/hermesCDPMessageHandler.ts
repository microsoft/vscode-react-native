// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.

import { Protocol as Cdp } from "devtools-protocol/types/protocol";
import { IProtocolCommand, IProtocolSuccess } from "vscode-cdp-proxy";
import { ProcessedCDPMessage, ProtocolMessage } from "./ICDPMessageHandler";
import { CDP_API_NAMES } from "./CDPAPINames";
import { BaseCDPMessageHandler } from "./baseCDPMessageHandler";

export class HermesCDPMessageHandler extends BaseCDPMessageHandler {
    /**
     * @description The Hermes native functions calls mark in call stack
     * @type {string}
     */
    private readonly HERMES_NATIVE_FUNCTION_NAME: string = "(native)";

    /**
     * @description Equals to 0xfffffff - the scriptId returned by Hermes debugger, that means "invalid script ID"
     * @type {string}
     */
    private readonly HERMES_NATIVE_FUNCTION_SCRIPT_ID: string = "4294967295";

    /**
     * @description Quiet period after the last breakpoint request before the application
     * is reloaded, so that a burst of breakpoint requests causes a single reload
     * @type {number}
     */
    private readonly RELOAD_DEBOUNCE_MS: number = 300;

    /**
     * @description Id of the out-of-band Page.reload request. The debugger never sent it,
     * so it discards the reply as an unknown response id
     * @type {number}
     */
    private readonly RELOAD_REQUEST_ID: number = 2147483646;

    private isFirstRun: boolean = true;
    private reloadTimer: NodeJS.Timeout | null = null;

    public processDebuggerCDPMessage(initialEvent: ProtocolMessage): ProcessedCDPMessage {
        let event = initialEvent;
        let sendBack = false;
        if ("method" in event) {
            if (event.method === CDP_API_NAMES.CLOSE) {
                this.cancelFirstRunReload();
            } else if (
                event.method === CDP_API_NAMES.DEBUGGER_SET_BREAKPOINT ||
                event.method === CDP_API_NAMES.DEBUGGER_SET_BREAKPOINT_BY_URL
            ) {
                this.scheduleFirstRunReload();
            }
        }
        if ("method" in event && "params" in event) {
            if (event.method === CDP_API_NAMES.DEBUGGER_SET_BREAKPOINT) {
                event = this.handleBreakpointSetting(event);
            } else if (event.method === CDP_API_NAMES.RUNTIME_CALL_FUNCTION_ON) {
                event = this.handleCallFunctionOnEvent(event);
                sendBack = true;
            }
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
            event.method === CDP_API_NAMES.DEBUGGER_PAUSED
        ) {
            processedEvent = this.handlePausedEvent(event);
        } else if ("result" in event && (event.result as { result?: unknown }).result) {
            processedEvent = this.handleFunctionTypeResult(event);
        }

        if (
            "method" in processedEvent &&
            "params" in processedEvent &&
            processedEvent.method === CDP_API_NAMES.RUNTIME_CONSOLE_API_CALLED
        ) {
            const args = (processedEvent.params as { args: Array<{ value: unknown }> }).args;
            if (String(args[0].value).includes("You are using an unsupported debugging client")) {
                args[0].value = "";
            }
        }

        return {
            event: processedEvent,
            sendBack: false,
        };
    }

    private handleCallFunctionOnEvent(event: IProtocolCommand): IProtocolSuccess {
        const params = event.params as { objectId?: unknown };
        return {
            id: event.id as number,
            result: {
                result: {
                    objectId: params.objectId,
                },
            },
        };
    }

    private handleFunctionTypeResult(event: IProtocolSuccess): IProtocolSuccess {
        const resultObj = event.result as { result?: unknown };
        if (Array.isArray(resultObj.result)) {
            const results = resultObj.result as Cdp.Runtime.PropertyDescriptor[];
            results.forEach(item => {
                if (item.value && item.value.type === "function" && !item.value.description) {
                    item.value.description = "function() { … }";
                }
            });
            resultObj.result = results;
        }
        return event;
    }

    private handlePausedEvent(event: IProtocolCommand): IProtocolCommand {
        const params = event.params as { callFrames: Cdp.Debugger.CallFrame[] };
        params.callFrames = params.callFrames.filter(
            callFrame =>
                callFrame.functionName !== this.HERMES_NATIVE_FUNCTION_NAME &&
                callFrame.location.scriptId !== this.HERMES_NATIVE_FUNCTION_SCRIPT_ID,
        );
        return event;
    }

    /**
     * The application finishes executing its bundle before the debugger manages to attach,
     * so breakpoints registered for the first run resolve but are never reached. Reload the
     * application once the debugger has finished sending its initial breakpoints, so that the
     * bundle is evaluated again while they are in place. Reloading is driven by the device
     * (the "nativePageReloads" capability), so the debugger stays attached across it.
     */
    private scheduleFirstRunReload(): void {
        if (!this.isFirstRun) {
            return;
        }

        if (this.reloadTimer) {
            clearTimeout(this.reloadTimer);
        }

        this.reloadTimer = setTimeout(() => {
            this.reloadTimer = null;

            if (!this.isFirstRun) {
                return;
            }
            this.isFirstRun = false;

            this.applicationTarget?.send({
                id: this.RELOAD_REQUEST_ID,
                method: CDP_API_NAMES.PAGE_RELOAD,
                params: {},
            });
        }, this.RELOAD_DEBOUNCE_MS);
    }

    private cancelFirstRunReload(): void {
        if (this.reloadTimer) {
            clearTimeout(this.reloadTimer);
            this.reloadTimer = null;
        }
        this.isFirstRun = true;
    }

    private handleBreakpointSetting(event: IProtocolCommand): IProtocolCommand {
        if (event.params) {
            const params = event.params as { location?: { columnNumber?: unknown } };
            if (params.location) {
                delete params.location.columnNumber;
            }
        }
        return event;
    }
}
