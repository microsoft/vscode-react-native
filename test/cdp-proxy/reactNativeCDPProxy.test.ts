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
import { LogLevel, LogHelper} from "../../src/extension/log/LogHelper";
import { DebuggerEndpointHelper } from "./../../src/cdp-proxy/debuggerEndpointHelper";
import { Request } from "../../src/common/node/request";

suite("reactNativeCDPProxy", function () {
    const cdpProxyHostAddress = "127.0.0.1"; // localhost
    const cdpProxyPort = generateRandomPortNumber();
    const cdpProxyLogLevel = LogHelper.LOG_LEVEL === LogLevel.Trace ? LogLevel.Custom : LogLevel.None;
    const proxy = new ReactNativeCDPProxy(cdpProxyHostAddress, cdpProxyPort);

    const wsAppPort = generateRandomPortNumber();

    let appConnection: Connection;
    let debugConnection: Connection;

    teardown(() => {
      proxy.stopServer();
    });

    suite("messagesHandlers", async () => {

        proxy.setApplicationTargetPort(wsAppPort);
        await proxy.initializeServer(new RnCDPMessageHandler(), cdpProxyLogLevel);
        await Server.create({ host: "localhost", port: wsAppPort })
          .then((server: Server) => {
            console.log("App server created");

            server.onConnection(([connection, request]: [Connection, Request]) => {
              console.log("App server connected");

              appConnection = connection;

              appConnection.onCommand((evt: IProtocolCommand) => {console.log(`App connection: ${evt.method}`); });
              appConnection.onReply((evt: IProtocolError | IProtocolSuccess) => {console.log(`App connection: ${evt}`); });
              appConnection.onError((evt: Error) => {console.log(`App connection: ${evt.message}`); });

              appConnection.send({method: "App.start", params: {reason: "other"}});
              appConnection.send({method: "App.run", params: {reason: "other"}});
            });
          });
          
        const proxyUri = await new DebuggerEndpointHelper().getWSEndpoint(`http://${cdpProxyHostAddress}:${cdpProxyPort}`);
        debugConnection = new Connection(await WebSocketTransport.create(proxyUri));
        debugConnection.onCommand((evt: IProtocolCommand) => {console.log(`Debug connection: ${evt.method}`); });
        debugConnection.onReply((evt: IProtocolError | IProtocolSuccess) => {console.log(`Debug connection: ${evt}`); });
        debugConnection.onError((evt: Error) => {console.log(`Debug connection: ${evt.message}`); });

        debugConnection.send({method: "Debugger.start", params: {reason: "other"}});
        debugConnection.send({method: "Debugger.run", params: {reason: "other"}});
  });
});