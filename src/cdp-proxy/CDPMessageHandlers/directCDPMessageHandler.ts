// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.

import Cdp = require("../../typings/cdp-proxy/cdp");
import { ICDPMessageHandler, ProtocolMessage } from "./ICDPMessageHandler";

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

    constructor() { }

    public processDebuggerCDPMessage(evt: any): ProtocolMessage {
        if (evt.method === "Debugger.setBreakpoint") {
            evt = this.handleBreakpointSetting(evt);
        }

        return evt;
    }

    public processApplicationCDPMessage(evt: any): ProtocolMessage {
        if (evt.method === "Debugger.paused") {
            evt = this.handlePausedEvent(evt);
        } else if (evt.result && evt.result.result) {
            evt = this.handleFunctionTypeResult(evt);
        }

        return evt;
    }

    private handleFunctionTypeResult(evt: any): any {
        if (Array.isArray(evt.result.result)) {
            let results: Cdp.Protocol.Runtime.PropertyDescriptor[] = evt.result.result;
            results.forEach((resultObj) => {
                if (resultObj.value && resultObj.value.type === "function" && !resultObj.value.description) {
                    resultObj.value.description = "function() { … }";
                }
            });

            evt.result.result = results;
        }
        return evt;
    }

    private handlePausedEvent(evt: any): any {
        let callFrames: Cdp.Protocol.Debugger.CallFrame[] = evt.params.callFrames;

        callFrames = callFrames.filter(callFrame =>
            callFrame.functionName !== this.HERMES_NATIVE_FUNCTION_NAME &&
            callFrame.location.scriptId !== this.HERMES_NATIVE_FUNCTION_SCRIPT_ID
        );
        evt.params.callFrames = callFrames;

        return evt;
    }

    private handleBreakpointSetting(evt: any): any {
        if (evt.params) {
            delete evt.params.location.columnNumber;
        }
        return evt;
    }
}
