// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.

import {
    Connection,
    Server,
    WebSocketTransport,
    IProtocolCommand,
} from "vscode-cdp-proxy";
import {ReactNativeCDPProxy} from "./../../src/cdp-proxy/reactNativeCDPProxy";
import {generateRandomPortNumber} from "./../../src/common/extensionHelper";
import {RnCDPMessageHandler} from "../../src/cdp-proxy/CDPMessageHandlers/rnCDPMessageHandler";
import {ICDPMessageHandler} from "../../src/cdp-proxy/CDPMessageHandlers/ICDPMessageHandler";
import {DirectCDPMessageHandler} from "../../src/cdp-proxy/CDPMessageHandlers/directCDPMessageHandler";
import {LogLevel, LogHelper} from "../../src/extension/log/LogHelper";
import {DebuggerEndpointHelper} from "./../../src/cdp-proxy/debuggerEndpointHelper";
import {Request} from "../../src/common/node/request";
import * as assert from "assert";

suite("reactNativeCDPProxy", function () {
    const cdpProxyHostAddress = "127.0.0.1"; // localhost
    const cdpProxyPort = generateRandomPortNumber();
    const cdpProxyLogLevel = LogHelper.LOG_LEVEL === LogLevel.Trace ? LogLevel.Custom : LogLevel.None;
    const proxy = new ReactNativeCDPProxy(cdpProxyHostAddress, cdpProxyPort);

    const wsTargetPort = generateRandomPortNumber();
    let wsTargetServer: Server | null;

    let targetConnection: Connection | null;
    let debugConnection: Connection | null;

    const sleep = async function (ms: number) {
      await new Promise((res) => {setTimeout(res, ms); });
    };

    suiteSetup(async () => {
      console.log("Start connection");
      proxy.setApplicationTargetPort(wsTargetPort);
      await proxy.initializeServer(new RnCDPMessageHandler(), cdpProxyLogLevel);

      await Server.create({ host: "localhost", port: wsTargetPort })
        .then((server: Server) => {
          console.log("Target server created");
          wsTargetServer = server;

          server.onConnection(([connection, request]: [Connection, Request]) => {
            console.log("Target server connected");

            targetConnection = connection;
          });
        });

      const proxyUri = await new DebuggerEndpointHelper().getWSEndpoint(`http://${cdpProxyHostAddress}:${cdpProxyPort}`);
      debugConnection = new Connection(await WebSocketTransport.create(proxyUri));

      while (!targetConnection) {
        await sleep(1000);
      }

      console.log("End connection");
    });

    suiteTeardown(() => {
      console.log("Start disconnection");
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

      console.log("End disconnection");
    });

    suite("messageHandlers", () => {

      const deliverlyTest = function (messageHandler: ICDPMessageHandler) {
        Object.assign(proxy, {CDPMessageHandler: messageHandler});

        return test(`Messages should be delivered correctly with ${(<Object>messageHandler).constructor.name}`, async () => {
          const targetMessageStart = {method: "Target.start", params: {reason: "other"}};
          const debuggerMessageStart = {method: "Debugger.start", params: {reason: "other"}};

          const messageFromTarget = await new Promise((resolve) => {
            targetConnection?.send(targetMessageStart);

            debugConnection?.onCommand((evt: IProtocolCommand) => {
              resolve(evt);
            });
          })
           .then((evt) => {
            console.log(evt);
            return evt;
          });

          const messageFromDebugger = await new Promise((resolve) => {
            debugConnection?.send(debuggerMessageStart);

            targetConnection?.onCommand((evt: IProtocolCommand) => {
              resolve(evt);
            });
          })
           .then((evt) => {
            console.log(evt);
            return evt;
          });

          assert.deepEqual(messageFromTarget, targetMessageStart);
          assert.deepEqual(messageFromDebugger, debuggerMessageStart);
        });
      };

      deliverlyTest(new RnCDPMessageHandler());
      deliverlyTest(new DirectCDPMessageHandler());
    });

});