// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.

import Cdp = require("../../typings/cdp-proxy/cdp");
import { ICDPMessageHandler, ProcessedCDPMessage } from "./ICDPMessageHandler";

export class DirectCDPMessageHandler implements ICDPMessageHandler {

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

    private readonly ARRAY_REQUEST_PHRASE_MARKER: string = "Object.getOwnPropertyDescriptor";

    constructor() { }

    public processDebuggerCDPMessage(event: any): ProcessedCDPMessage {
        let reverseDirection = false;
        if (event.method === "Debugger.setBreakpoint") {
            event = this.handleBreakpointSetting(event);
        } else if (event.method === "Runtime.callFunctionOn") {
            if (event.params.functionDeclaration.includes(this.ARRAY_REQUEST_PHRASE_MARKER)) {
                event = this.handleCallFunctionOnEvent(event);
                reverseDirection = true;
            }
        }

        return {
            event,
            reverseDirection,
        };
    }

    public processApplicationCDPMessage(event: any): ProcessedCDPMessage {
        let reverseDirection = false;
        if (event.method === "Debugger.paused") {
            event = this.handlePausedEvent(event);
        } else if (event.result && event.result.result) {
            event = this.handleFunctionTypeResult(event);
        }

        return {
            event,
            reverseDirection,
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
            let results: Cdp.Protocol.Runtime.PropertyDescriptor[] = event.result.result;
            results.forEach((resultObj) => {
                if (resultObj.value && resultObj.value.type === "function" && !resultObj.value.description) {
                    resultObj.value.description = "function() { … }";
                }
            });

            event.result.result = results;
        }
        return event;
    }

    private handlePausedEvent(event: any): any {
        let callFrames: Cdp.Protocol.Debugger.CallFrame[] = event.params.callFrames;

        callFrames = callFrames.filter(callFrame =>
            callFrame.functionName !== this.HERMES_NATIVE_FUNCTION_NAME &&
            callFrame.location.scriptId !== this.HERMES_NATIVE_FUNCTION_SCRIPT_ID
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
