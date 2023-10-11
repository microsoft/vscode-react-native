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

    public processDebuggerCDPMessage(event: any): ProcessedCDPMessage {
        let sendBack = false;
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

    private handleBreakpointSetting(event: any): any {
        if (event.params) {
            delete event.params.location.columnNumber;
        }
        return event;
    }
}
