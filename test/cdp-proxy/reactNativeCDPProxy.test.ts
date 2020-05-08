// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.

import {
    Connection,
    Server,
    WebSocketTransport,
    IProtocolCommand,
    IProtocolError,
    IProtocolSuccess
} from "vscode-cdp-proxy";
import {ReactNativeCDPProxy} from "./../../src/cdp-proxy/reactNativeCDPProxy";
import {generateRandomPortNumber} from "./../../src/common/extensionHelper";
import {RnCDPMessageHandler} from "../../src/cdp-proxy/CDPMessageHandlers/rnCDPMessageHandler";
import {ICDPMessageHandler} from "../../src/cdp-proxy/CDPMessageHandlers/ICDPMessageHandler";
import {DirectCDPMessageHandler} from "../../src/cdp-proxy/CDPMessageHandlers/directCDPMessageHandler";
import {LogLevel} from "../../src/extension/log/LogHelper";
import {DebuggerEndpointHelper} from "./../../src/cdp-proxy/debuggerEndpointHelper";
import {Request} from "../../src/common/node/request";
import * as assert from "assert";
import {CDP_API_NAMES} from "../../src/cdp-proxy/CDPMessageHandlers/CDPAPINames";
import {PromiseUtil} from "../../src/common/node/promise";

suite("reactNativeCDPProxy", function () {
    const promiseUtil = new PromiseUtil();

    const cdpProxyHostAddress = "127.0.0.1"; // localhost
    const cdpProxyPort = generateRandomPortNumber();
    const cdpProxyLogLevel = LogLevel.Custom;
    const proxy = new ReactNativeCDPProxy(cdpProxyHostAddress, cdpProxyPort);

    const wsTargetPort = generateRandomPortNumber();
    let wsTargetServer: Server | null;

    let targetConnection: Connection | null;
    let debugConnection: Connection | null;

    suiteSetup(async () => {
      proxy.setApplicationTargetPort(wsTargetPort);
      await proxy.initializeServer(new RnCDPMessageHandler(), cdpProxyLogLevel);

      await Server.create({ host: "localhost", port: wsTargetPort })
        .then((server: Server) => {
          wsTargetServer = server;

          server.onConnection(([connection, request]: [Connection, Request]) => {
            targetConnection = connection;
          });
        });

      const proxyUri = await new DebuggerEndpointHelper().getWSEndpoint(`http://${cdpProxyHostAddress}:${cdpProxyPort}`);
      debugConnection = new Connection(await WebSocketTransport.create(proxyUri));

      while (!targetConnection) {
        await promiseUtil.delay(1000);
      }
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
      let directHandler = new DirectCDPMessageHandler();

      const deliveryTest = function (messageHandler: ICDPMessageHandler) {

        return test(`Messages should be delivered correctly with ${(<Object>messageHandler).constructor.name}`, async () => {
          const targetMessageStart = {method: "Target.start", params: {reason: "test"}};
          const debuggerMessageStart = {method: "Debugger.start", params: {reason: "test"}};

          const messageFromTarget = await new Promise((resolve) => {
            targetConnection?.send(targetMessageStart);

            debugConnection?.onCommand((evt: IProtocolCommand) => {
              resolve(evt);
            });
          })
           .then((evt) => {
            return evt;
          });

          const messageFromDebugger = await new Promise((resolve) => {
            debugConnection?.send(debuggerMessageStart);

            targetConnection?.onCommand((evt: IProtocolCommand) => {
              resolve(evt);
            });
          })
           .then((evt) => {
            return evt;
          });

          assert.deepEqual(messageFromTarget, targetMessageStart);
          assert.deepEqual(messageFromDebugger, debuggerMessageStart);
        });
      };

      suite(`${(<Object>rnHandler).constructor.name}`, () => {

        suiteSetup(async () => {
          rnHandler = new RnCDPMessageHandler();
          Object.assign(proxy, {CDPMessageHandler: rnHandler});
        });

        deliveryTest(rnHandler);

        test(`Message from target with method '${CDP_API_NAMES.DEBUGGER_PAUSED}' in first time should transorm reason to 'Break on start'`, async () => {
          const targetMessagePaused = {method: CDP_API_NAMES.DEBUGGER_PAUSED, params: {reason: "other"}};

          const messageFromTarget = await new Promise((resolve) => {
            targetConnection?.send(targetMessagePaused);

            debugConnection?.onCommand((evt: IProtocolCommand) => {
              resolve(evt);
            });
          })
           .then((evt) => {
             targetMessagePaused.params.reason = "Break on start";
             return evt;
          });

          assert.deepEqual(messageFromTarget, targetMessagePaused);
        });
      });

      suite(`${(<Object>directHandler).constructor.name}`, () => {
        const HERMES_NATIVE_FUNCTION_NAME: string = "(native)";
        const HERMES_NATIVE_FUNCTION_SCRIPT_ID: string = "4294967295";
        const ARRAY_REQUEST_PHRASE_MARKER: string = "Object.getOwnPropertyDescriptor";

        suiteSetup(async () => {
          directHandler = new DirectCDPMessageHandler();
          Object.assign(proxy, {CDPMessageHandler: directHandler});
        });

        deliveryTest(directHandler);

        test(`Message from target with method '${CDP_API_NAMES.DEBUGGER_PAUSED}' should filter callFrames with Hermes Native function name and script id`, async () => {
          const callFrames: any = [
            {
              functionName: HERMES_NATIVE_FUNCTION_NAME,
              location: {
                scriptId: "1",
              },
            },
            {
              functionName: "name",
              location: {
                scriptId: HERMES_NATIVE_FUNCTION_SCRIPT_ID,
              },
            },
            {
              functionName: "name",
              location: {
                scriptId: "2",
              },
            },
            {
              functionName: "name1",
              location: {
                scriptId: "3",
              },
            },
          ];
          const targetMessagePaused = {
            method: CDP_API_NAMES.DEBUGGER_PAUSED,
            params: {
              reason: "other",
              callFrames: callFrames,
            },
          };

          const messageFromTarget = await new Promise((resolve) => {
            targetConnection?.send(targetMessagePaused);

            debugConnection?.onCommand((evt: IProtocolCommand) => {
              resolve(evt);
            });
          })
           .then((evt) => {
             const filteredCallFrames = callFrames.filter((callFrame: any) =>
              callFrame.functionName !== HERMES_NATIVE_FUNCTION_NAME &&
              callFrame.location.scriptId !== HERMES_NATIVE_FUNCTION_SCRIPT_ID
             );
             targetMessagePaused.params.callFrames = filteredCallFrames;
             return evt;
          });

          assert.deepEqual(messageFromTarget, targetMessagePaused);
        });

        test(`Message from target should add description for function result without description`, async () => {
          const targetMessage = {
            method: "Target.test",
            params: {
              reason: "test",
            },
            result: {
              result: [
                {
                  value: {
                    type: "function",
                    description: undefined,
                  },
                },
                {
                  value: {
                    type: "function",
                    description: "description",
                  },
                },
              ],
            },
          };

          const messageFromTarget = await new Promise((resolve) => {
            targetConnection?.send(targetMessage);

            debugConnection?.onCommand((evt: IProtocolCommand) => {
              resolve(evt);
            });
          })
           .then((evt) => {
            targetMessage.result.result.forEach((resultObj) => {
              if (resultObj.value && resultObj.value.type === "function" && !resultObj.value.description) {
                  resultObj.value.description = "function() { … }";
              }
            });
            return evt;
          });

          assert.deepEqual(messageFromTarget, targetMessage);
        });

        test(`Message from debugger with method ${CDP_API_NAMES.DEBUGGER_SET_BREAKPOINT} should delete column number field from params.location`, async () => {
          const debuggerMessage = {
            method: CDP_API_NAMES.DEBUGGER_SET_BREAKPOINT,
            params: {
              reason: "test",
              location: {
                columnNumber: 15,
                rowNumber: 100,
              },
            },
          };

          const messageFromDebugger = await new Promise((resolve) => {
            debugConnection?.send(debuggerMessage);

            targetConnection?.onCommand((evt: IProtocolCommand) => {
              resolve(evt);
            });
          })
           .then((evt) => {
            delete debuggerMessage.params.location.columnNumber;
            return evt;
          });

          assert.deepEqual(messageFromDebugger, debuggerMessage);
        });

        test(`Message from debugger with method ${CDP_API_NAMES.RUNTIME_CALL_FUNCTION_ON} with ${ARRAY_REQUEST_PHRASE_MARKER} in function declaration should return result based on message id and send back to debugger`, async () => {
          const debuggerMessage = {
            id: 1,
            method: CDP_API_NAMES.RUNTIME_CALL_FUNCTION_ON,
            params: {
              objectId: 2,
              reason: "test",
              functionDeclaration: [
                ARRAY_REQUEST_PHRASE_MARKER,
                "some other",
              ],
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

          const messageFromDebugger = await new Promise((resolve) => {
            debugConnection?.send(debuggerMessage);

            debugConnection?.onReply((evt: IProtocolError | IProtocolSuccess) => {
              resolve(evt);
            });
          })
           .then((evt) => {
            return evt;
          });

          assert.deepEqual(messageFromDebugger, resultMessage);
        });

      });


    });

});
