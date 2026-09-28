// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.

import { Protocol as Cdp } from "devtools-protocol/types/protocol";
import { ProcessedCDPMessage } from "./ICDPMessageHandler";
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

    public processDebuggerCDPMessage(event: any): ProcessedCDPMessage {
        let sendBack = false;
        if (event.method === CDP_API_NAMES.CLOSE) {
            this.cancelFirstRunReload();
        } else if (
            event.method === CDP_API_NAMES.DEBUGGER_SET_BREAKPOINT ||
            event.method === CDP_API_NAMES.DEBUGGER_SET_BREAKPOINT_BY_URL
        ) {
            this.scheduleFirstRunReload();
        }

        if (event.method === CDP_API_NAMES.DEBUGGER_SET_BREAKPOINT) {
            event = this.handleBreakpointSetting(event);
        } else if (event.method === CDP_API_NAMES.RUNTIME_CALL_FUNCTION_ON) {
            event = this.handleCallFunctionOnEvent(event);
            sendBack = true;
        }

        return {
            event,
            sendBack,
        };
    }

    public processApplicationCDPMessage(event: any): ProcessedCDPMessage {
        const sendBack = false;
        if (event.method === CDP_API_NAMES.DEBUGGER_PAUSED) {
            event = this.handlePausedEvent(event);
        } else if (event.result && event.result.result) {
            event = this.handleFunctionTypeResult(event);
        }

        // Handle unused console log in cdp event
        if (
            event.method === CDP_API_NAMES.RUNTIME_CONSOLE_API_CALLED &&
            String(event.params.args[0].value).includes(
                "You are using an unsupported debugging client",
            )
        ) {
            event.params.args[0].value = "";
        }

        return {
            event,
            sendBack,
        };
    }

    private handleCallFunctionOnEvent(event: any): any {
        return {
            result: {
                result: {
                    objectId: event.params.objectId,
                },
            },
            id: event.id,
        };
    }

    private handleFunctionTypeResult(event: any): any {
        if (Array.isArray(event.result.result)) {
            const results: Cdp.Runtime.PropertyDescriptor[] = event.result.result;
            results.forEach(resultObj => {
                if (
                    resultObj.value &&
                    resultObj.value.type === "function" &&
                    !resultObj.value.description
                ) {
                    resultObj.value.description = "function() { … }";
                }
            });

            event.result.result = results;
        }
        return event;
    }

    private handlePausedEvent(event: any): any {
        let callFrames: Cdp.Debugger.CallFrame[] = event.params.callFrames;

        callFrames = callFrames.filter(
            callFrame =>
                callFrame.functionName !== this.HERMES_NATIVE_FUNCTION_NAME &&
                callFrame.location.scriptId !== this.HERMES_NATIVE_FUNCTION_SCRIPT_ID,
        );
        event.params.callFrames = callFrames;

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

    private handleBreakpointSetting(event: any): any {
        if (event.params) {
            delete event.params.location.columnNumber;
        }
        return event;
    }
}
