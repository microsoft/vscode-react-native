// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.

import assert = require("assert");
import * as sinon from "sinon";
import { DebuggerEndpointHelper } from "../../src/cdp-proxy/debuggerEndpointHelper";
import { PromiseUtil } from "../../src/common/node/promise";

suite("debuggerEndpointHelper", function () {
    const stubs: Sinon.SinonStub[] = [];

    teardown(function () {
        while (stubs.length) {
            stubs.pop()!.restore();
        }
    });

    test("getWSEndpoint should return /json/version webSocketDebuggerUrl when present", async function () {
        const helper = new DebuggerEndpointHelper();
        const fetchJsonStub = sinon.stub(helper as any, "fetchJson");
        stubs.push(fetchJsonStub);
        fetchJsonStub.returns(Promise.resolve({ webSocketDebuggerUrl: "ws://version" }));

        const endpoint = await helper.getWSEndpoint("http://localhost:9222");

        assert.strictEqual(endpoint, "ws://version");
        assert.strictEqual(fetchJsonStub.calledOnce, true);
        assert.strictEqual(fetchJsonStub.firstCall.args[0], "http://localhost:9222/json/version");
    });

    test("getWSEndpoint should fallback to /json/list and select Hermes improved reload target", async function () {
        const helper = new DebuggerEndpointHelper();
        const fetchJsonStub = sinon.stub(helper as any, "fetchJson");
        stubs.push(fetchJsonStub);
        fetchJsonStub.onCall(0).returns(Promise.resolve({}));
        fetchJsonStub.onCall(1).returns(
            Promise.resolve([
                {
                    title: "React Native",
                    description: "",
                    webSocketDebuggerUrl: "ws://first",
                },
                {
                    title: "React Native Experimental (Improved Chrome Reloads)",
                    description: "",
                    webSocketDebuggerUrl: "ws://hermes-improved-reloads",
                },
            ]),
        );

        const endpoint = await helper.getWSEndpoint("http://localhost:9222", true);

        assert.strictEqual(endpoint, "ws://hermes-improved-reloads");
        assert.strictEqual(fetchJsonStub.secondCall.args[0], "http://localhost:9222/json/list");
    });

    test("getWSEndpoint should fallback to default Metro endpoint when target list is empty", async function () {
        const helper = new DebuggerEndpointHelper();
        const fetchJsonStub = sinon.stub(helper as any, "fetchJson");
        stubs.push(fetchJsonStub);
        fetchJsonStub.onCall(0).returns(Promise.resolve({}));
        fetchJsonStub.onCall(1).returns(Promise.resolve([]));
        fetchJsonStub.onCall(2).returns(
            Promise.resolve([
                {
                    title: "React Native",
                    description: "",
                    webSocketDebuggerUrl: "ws://metro-default",
                },
            ]),
        );

        const endpoint = await helper.getWSEndpoint("http://localhost:9222");

        assert.strictEqual(endpoint, "ws://metro-default");
        assert.strictEqual(fetchJsonStub.thirdCall.args[0], "http://localhost:8081/json/list");
    });

    test("getDebuggerTpye should detect expo targets", async function () {
        const helper = new DebuggerEndpointHelper();
        const fetchJsonStub = sinon.stub(helper as any, "fetchJson");
        stubs.push(fetchJsonStub);
        fetchJsonStub.returns(
            Promise.resolve([
                {
                    title: "Exponent App",
                    description: "React Native target",
                    webSocketDebuggerUrl: "ws://expo",
                },
            ]),
        );

        const debuggerType = await helper.getDebuggerTpye("http://localhost:9222");

        assert.strictEqual(debuggerType, "expo");
    });

    test("getDebuggerTpye should default to react-native targets", async function () {
        const helper = new DebuggerEndpointHelper();
        const fetchJsonStub = sinon.stub(helper as any, "fetchJson");
        stubs.push(fetchJsonStub);
        fetchJsonStub.returns(
            Promise.resolve([
                {
                    title: "React Native",
                    description: "Hermes target",
                    webSocketDebuggerUrl: "ws://react-native",
                },
            ]),
        );

        const debuggerType = await helper.getDebuggerTpye("http://localhost:9222");

        assert.strictEqual(debuggerType, "react-native");
    });

    test("retryGetWSEndpoint should retry without waiting on real timers", async function () {
        const helper = new DebuggerEndpointHelper();
        const getWSEndpointStub = sinon.stub(helper, "getWSEndpoint");
        const delayStub = sinon.stub(PromiseUtil, "delay");
        stubs.push(getWSEndpointStub, delayStub);
        getWSEndpointStub.onCall(0).returns(Promise.reject(new Error("not ready")));
        getWSEndpointStub.onCall(1).returns(Promise.resolve("ws://ready"));
        delayStub.returns(Promise.resolve());

        const endpoint = await helper.retryGetWSEndpoint("http://localhost:9222", 1, {
            isCancellationRequested: false,
        } as any);

        assert.strictEqual(endpoint, "ws://ready");
        assert.strictEqual(getWSEndpointStub.calledTwice, true);
        assert.strictEqual(delayStub.calledOnce, true);
        assert.strictEqual(delayStub.calledWithExactly(700), true);
    });

    test("retryGetWSEndpoint should stop when cancellation is requested", async function () {
        const helper = new DebuggerEndpointHelper();
        const getWSEndpointStub = sinon.stub(helper, "getWSEndpoint");
        const delayStub = sinon.stub(PromiseUtil, "delay");
        stubs.push(getWSEndpointStub, delayStub);
        getWSEndpointStub.returns(Promise.reject(new Error("not ready")));
        delayStub.returns(Promise.resolve());

        try {
            await helper.retryGetWSEndpoint("http://localhost:9222", 1, {
                isCancellationRequested: true,
            } as any);
            assert.fail("Expected retryGetWSEndpoint to throw");
        } catch (err) {
            assert.strictEqual(getWSEndpointStub.calledOnce, true);
            assert.strictEqual(delayStub.notCalled, true);
            assert(err instanceof Error);
        }
    });
});
