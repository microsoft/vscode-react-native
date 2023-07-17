// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.

import * as Net from "net";
import * as vscode from "vscode";
import { RNDebugSession } from "../debugger/rnDebugSession";
import { TerminateEventArgs } from "../debugger/debugSessionBase";
import { DirectDebugSession } from "../debugger/direct/directDebugSession";
import { RNSession } from "../debugger/debugSessionWrapper";
import { DEBUG_TYPES } from "./debuggingConfiguration/debugConfigTypesAndConstants";
import { WebDebugSession } from "../debugger/webDebugSession";

export class ReactNativeSessionManager
    implements vscode.DebugAdapterDescriptorFactory, vscode.Disposable
{
    private servers = new Map<string, Net.Server>();
    private connections = new Map<string, Net.Socket>();

    public createDebugAdapterDescriptor(
        session: vscode.DebugSession,
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        executable: vscode.DebugAdapterExecutable | undefined,
    ): vscode.ProviderResult<vscode.DebugAdapterDescriptor> {
        const rnSession = new RNSession(session);

        let debugServer;
        if (session.configuration.platform != "expoweb") {
            debugServer = Net.createServer(socket => {
                const rnDebugSession =
                    session.type === DEBUG_TYPES.REACT_NATIVE
                        ? new RNDebugSession(rnSession)
                        : new DirectDebugSession(rnSession);

                this.connections.set(session.id, socket);

                rnDebugSession.setRunAsServer(true);
                rnDebugSession.start(<NodeJS.ReadableStream>socket, socket);
            });
        } else {
            debugServer = Net.createServer(socket => {
                const cordovaDebugSession = new WebDebugSession(rnSession);
                cordovaDebugSession.setRunAsServer(true);
                this.connections.set(session.id, socket);
                cordovaDebugSession.start(<NodeJS.ReadableStream>socket, socket);
            });
        }

        debugServer.listen(0);
        this.servers.set(session.id, debugServer);

        // make VS Code connect to debug server
        return new vscode.DebugAdapterServer((<Net.AddressInfo>debugServer.address()).port);
    }

    public terminate(terminateEvent: TerminateEventArgs): void {
        this.destroyServer(
            terminateEvent.debugSession.id,
            this.servers.get(terminateEvent.debugSession.id),
        );

        const connection = this.connections.get(terminateEvent.debugSession.id);
        if (connection) {
            if (terminateEvent.args.forcedStop) {
                this.destroyConnection(connection);
            }
            this.connections.delete(terminateEvent.debugSession.id);
        }
    }

    public dispose(): void {
        this.servers.forEach((server, key) => {
            this.destroyServer(key, server);
        });
        this.connections.forEach((conn, key) => {
            this.destroyConnection(conn);
            this.connections.delete(key);
        });
    }

    private destroyConnection(connection: Net.Socket) {
        connection.removeAllListeners();
        connection.on("error", () => undefined);
        connection.destroy();
    }

    private destroyServer(sessionId: string, server?: Net.Server) {
        if (server) {
            server.close();
            this.servers.delete(sessionId);
        }
    }
}
