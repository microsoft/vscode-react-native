// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.

import {
    Connection,
    Server,
    WebSocketTransport,
    IProtocolCommand,
    IProtocolError,
    IProtocolSuccess,
} from "vscode-cdp-proxy";
import { ReactNativeCDPProxy } from "./../../src/cdp-proxy/reactNativeCDPProxy";
import { generateRandomPortNumber } from "./../../src/common/extensionHelper";
import { RnCDPMessageHandler } from "../../src/cdp-proxy/CDPMessageHandlers/rnCDPMessageHandler";
import { ICDPMessageHandler } from "../../src/cdp-proxy/CDPMessageHandlers/ICDPMessageHandler";
import { HermesCDPMessageHandler } from "../../src/cdp-proxy/CDPMessageHandlers/hermesCDPMessageHandler";
import { LogLevel } from "../../src/extension/log/LogHelper";
import { DebuggerEndpointHelper } from "./../../src/cdp-proxy/debuggerEndpointHelper";
import { Request } from "../../src/common/node/request";
import * as assert from "assert";
import { CDP_API_NAMES } from "../../src/cdp-proxy/CDPMessageHandlers/CDPAPINames";
import {
    HERMES_NATIVE_FUNCTION_NAME,
    HERMES_NATIVE_FUNCTION_SCRIPT_ID,
    ARRAY_REQUEST_PHRASE_MARKER,
    mockCallFrames,
    mockResults,
} from "./cdpConstants";
import { PromiseUtil } from "../../src/common/node/promise";

suite("reactNativeCDPProxy", function () {
    const cdpProxyHostAddress = "127.0.0.1"; // localhost
    const cdpProxyPort = generateRandomPortNumber();
    const cdpProxyLogLevel = LogLevel.Custom;
    const proxy = new ReactNativeCDPProxy(cdpProxyHostAddress, cdpProxyPort);

    const wsTargetPort = generateRandomPortNumber();
    let wsTargetServer: Server | null;

    let targetConnection: Connection | null;
    let debugConnection: Connection | null;

    // For all hooks and tests set a time limit
    this.timeout(5000);

    async function getMessageFromTarget(message: any): Promise<any> {
        return new Promise(resolve => {
            targetConnection?.send(message);

            debugConnection?.onCommand((evt: IProtocolCommand) => {
                resolve(evt);
            });
        });
    }

    async function getMessageFromDebugger(message: any): Promise<any> {
        return new Promise(resolve => {
            debugConnection?.send(message);

            targetConnection?.onCommand((evt: IProtocolCommand) => {
                resolve(evt);
            });
        });
    }

    suiteSetup(async () => {
        proxy.setApplicationTargetPort(wsTargetPort);
        await proxy.initializeServer(new RnCDPMessageHandler(), cdpProxyLogLevel);

        const server = await Server.create({ host: "localhost", port: wsTargetPort });
        wsTargetServer = server;
        server.onConnection(([connection, request]: [Connection, Request]) => {
            targetConnection = connection;
        });

        const proxyUri = await new DebuggerEndpointHelper().getWSEndpoint(
            `http://${cdpProxyHostAddress}:${cdpProxyPort}`,
        );
        debugConnection = new Connection(await WebSocketTransport.create(proxyUri));

        // Due to the time limit, sooner or later this cycle will end
        await PromiseUtil.waitUntil(() => !!targetConnection, 1000, 5000);
    });

    suiteTeardown(() => {
        if (targetConnection) {
            targetConnection.close();
            targetConnection = null;
        }
        if (debugConnection) {
            debugConnection.close();
            debugConnection = null;
        }
        proxy.stopServer();
        if (wsTargetServer) {
            wsTargetServer.dispose();
            wsTargetServer = null;
        }
    });

    suite("MessageHandlers", () => {
        let rnHandler = new RnCDPMessageHandler();
        let directHandler = new HermesCDPMessageHandler();

        function deliveryTest(messageHandler: ICDPMessageHandler): Mocha.Test {
            return test(`Messages should be delivered correctly with ${messageHandler.constructor.name}`, async () => {
                const targetMessageStart = { method: "Target.start", params: { reason: "test" } };
                const debuggerMessageStart = {
                    method: "Debugger.start",
                    params: { reason: "test" },
                };

                const messageFromTarget = await getMessageFromTarget(targetMessageStart);
                const messageFromDebugger = await getMessageFromDebugger(debuggerMessageStart);

                assert.deepStrictEqual(messageFromTarget, targetMessageStart);
                assert.deepStrictEqual(messageFromDebugger, debuggerMessageStart);
            });
        }

        suite(`${rnHandler.constructor.name}`, () => {
            suiteSetup(async () => {
                rnHandler = new RnCDPMessageHandler();
                Object.assign(proxy, { CDPMessageHandler: rnHandler });
            });

            deliveryTest(rnHandler);

            test(`Message from target with method '${CDP_API_NAMES.DEBUGGER_PAUSED}' in first time should transorm reason to 'Break on start'`, async () => {
                const targetMessagePaused = {
                    method: CDP_API_NAMES.DEBUGGER_PAUSED,
                    params: { reason: "other" },
                };

                const messageFromTarget = await getMessageFromTarget(targetMessagePaused);
                targetMessagePaused.params.reason = "Break on start";

                assert.deepStrictEqual(messageFromTarget, targetMessagePaused);
            });
        });

        suite(`${directHandler.constructor.name}`, () => {
            suiteSetup(async () => {
                directHandler = new HermesCDPMessageHandler();
                Object.assign(proxy, { CDPMessageHandler: directHandler });
            });

            deliveryTest(directHandler);

            test(`Message from target with method '${CDP_API_NAMES.DEBUGGER_PAUSED}' should filter callFrames with Hermes Native function name and script id`, async () => {
                const targetMessagePaused = {
                    method: CDP_API_NAMES.DEBUGGER_PAUSED,
                    params: {
                        reason: "other",
                        callFrames: mockCallFrames,
                    },
                };

                const messageFromTarget = await getMessageFromTarget(targetMessagePaused);
                const filteredCallFrames = mockCallFrames.filter(
                    (callFrame: any) =>
                        callFrame.functionName !== HERMES_NATIVE_FUNCTION_NAME &&
                        callFrame.location.scriptId !== HERMES_NATIVE_FUNCTION_SCRIPT_ID,
                );
                targetMessagePaused.params.callFrames = filteredCallFrames;

                assert.deepStrictEqual(messageFromTarget, targetMessagePaused);
            });

            test(`Message from target should add description for function result without description`, async () => {
                const targetMessage = {
                    method: "Target.test",
                    params: {
                        reason: "test",
                    },
                    result: mockResults,
                };

                const messageFromTarget = await getMessageFromTarget(targetMessage);
                targetMessage.result.result.forEach(resultObj => {
                    if (
                        resultObj.value &&
                        resultObj.value.type === "function" &&
                        !resultObj.value.description
                    ) {
                        resultObj.value.description = "function() { … }";
                    }
                });

                assert.deepStrictEqual(messageFromTarget, targetMessage);
            });

            test(`Message from debugger with method ${CDP_API_NAMES.DEBUGGER_SET_BREAKPOINT} should delete column number field from params.location`, async () => {
                const debuggerMessage: any = {
                    method: CDP_API_NAMES.DEBUGGER_SET_BREAKPOINT,
                    params: {
                        reason: "test",
                        location: {
                            columnNumber: 15,
                            rowNumber: 100,
                        },
                    },
                };

                const messageFromDebugger = await getMessageFromDebugger(debuggerMessage);
                delete debuggerMessage.params.location.columnNumber;

                assert.deepStrictEqual(messageFromDebugger, debuggerMessage);
            });

            test(`Message from debugger with method ${CDP_API_NAMES.RUNTIME_CALL_FUNCTION_ON} with ${ARRAY_REQUEST_PHRASE_MARKER} in function declaration should return result based on message id and send back to debugger`, async () => {
                const debuggerMessage = {
                    id: 1,
                    method: CDP_API_NAMES.RUNTIME_CALL_FUNCTION_ON,
                    params: {
                        objectId: 2,
                        reason: "test",
                        functionDeclaration: [ARRAY_REQUEST_PHRASE_MARKER, "some other"],
                    },
                };
                let resultMessage = {
                    result: {
                        result: {
                            objectId: debuggerMessage.params.objectId,
                        },
                    },
                    id: debuggerMessage.id,
                };

                const messageFromDebugger = await new Promise(resolve => {
                    debugConnection?.send(debuggerMessage);

                    debugConnection?.onReply((evt: IProtocolError | IProtocolSuccess) => {
                        resolve(evt);
                    });
                });

                assert.deepStrictEqual(messageFromDebugger, resultMessage);
            });
        });
    });
});
