// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.

import { Connection } from "vscode-cdp-proxy";
import { HermesCDPMessageHandler } from "../../src/cdp-proxy/CDPMessageHandlers/hermesCDPMessageHandler";
import { CDP_API_NAMES } from "../../src/cdp-proxy/CDPMessageHandlers/CDPAPINames";
import { PromiseUtil } from "../../src/common/node/promise";
import assert = require("assert");

suite("hermesCDPMessageHandler", function () {
    // Must outlast RELOAD_DEBOUNCE_MS (300) in the handler
    const afterDebounce = 500;

    function createHandler(): {
        handler: HermesCDPMessageHandler;
        sent: Array<Record<string, any>>;
    } {
        const handler = new HermesCDPMessageHandler();
        const sent: Array<Record<string, any>> = [];
        handler.setApplicationTarget({
            send: (message: Record<string, any>) => sent.push(message),
        } as unknown as Connection);
        return { handler, sent };
    }

    suite("first run reload", function () {
        test("reloads the application once the debugger has sent its breakpoints", async () => {
            const { handler, sent } = createHandler();

            handler.processDebuggerCDPMessage({
                method: CDP_API_NAMES.DEBUGGER_SET_BREAKPOINT_BY_URL,
                params: {},
            });
            await PromiseUtil.delay(afterDebounce);

            assert.strictEqual(sent.length, 1);
            assert.strictEqual(sent[0].method, CDP_API_NAMES.PAGE_RELOAD);
        });

        test("coalesces a burst of breakpoints into a single reload", async () => {
            const { handler, sent } = createHandler();

            for (let i = 0; i < 5; i++) {
                handler.processDebuggerCDPMessage({
                    method: CDP_API_NAMES.DEBUGGER_SET_BREAKPOINT_BY_URL,
                    params: {},
                });
            }
            await PromiseUtil.delay(afterDebounce);

            assert.strictEqual(sent.length, 1);
        });

        test("does not reload again for later breakpoints in the same session", async () => {
            const { handler, sent } = createHandler();

            handler.processDebuggerCDPMessage({
                method: CDP_API_NAMES.DEBUGGER_SET_BREAKPOINT_BY_URL,
                params: {},
            });
            await PromiseUtil.delay(afterDebounce);

            handler.processDebuggerCDPMessage({
                method: CDP_API_NAMES.DEBUGGER_SET_BREAKPOINT_BY_URL,
                params: {},
            });
            await PromiseUtil.delay(afterDebounce);

            assert.strictEqual(sent.length, 1);
        });

        test("does not reload after the debugger disconnects", async () => {
            const { handler, sent } = createHandler();

            handler.processDebuggerCDPMessage({
                method: CDP_API_NAMES.DEBUGGER_SET_BREAKPOINT_BY_URL,
                params: {},
            });
            handler.processDebuggerCDPMessage({ method: CDP_API_NAMES.CLOSE });
            await PromiseUtil.delay(afterDebounce);

            assert.strictEqual(sent.length, 0);
        });

        test("leaves breakpoint messages on their way to the application", function () {
            const { handler } = createHandler();

            const processed = handler.processDebuggerCDPMessage({
                method: CDP_API_NAMES.DEBUGGER_SET_BREAKPOINT,
                params: { location: { lineNumber: 1, columnNumber: 2 } },
            });

            const event = processed.event as Record<string, any>;

            assert.strictEqual(processed.sendBack, false);
            assert.strictEqual(event.method, CDP_API_NAMES.DEBUGGER_SET_BREAKPOINT);
            // Hermes rejects breakpoints carrying a column number
            assert.strictEqual(event.params.location.columnNumber, undefined);
        });
    });
});
