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
import { URL } from "url";
import { IncomingMessage } from "http";

export class RnCdpProxy {
    private server: Server | null;
    private hostAddress: string;
    private port: number;
    private debuggerTarget: Connection;
    private applicationTarget: Connection;

    constructor(port = 13602, hostAddress = "127.0.0.1") {
        this.port = port;
        this.hostAddress = hostAddress;
    }

    public createServer(): Promise<void> {
        return Server.create({ port: this.port, host: this.hostAddress })
            .then((server: Server) => {
                this.server = server;
                this.server.onConnection(this.onConnectionHandler.bind(this));
            });
    }

    public stopServer(): void {
        if (this.server) {
            this.server.dispose();
            this.server = null;
        }
    }

    public getInspectUriTemplate(): string {
        return `ws://${this.hostAddress}:${this.port}?browser={browserInspectUri}`;
    }

    private async onConnectionHandler([debuggerTarget, request]: [Connection, IncomingMessage]): Promise<void> {
        this.debuggerTarget = debuggerTarget;
        const browserInspectUri = this.getBrowserInspectUri(request);

        this.debuggerTarget.pause(); // don't listen for events until the target is ready

        this.applicationTarget = new Connection(await WebSocketTransport.create(browserInspectUri));

        this.applicationTarget.onError(this.onApplicationTargetError.bind(this));
        this.debuggerTarget.onError(this.onDebuggerTargetError.bind(this));

        this.applicationTarget.onCommand(this.handleApplicationTargetCommand.bind(this));
        this.debuggerTarget.onCommand(this.handleDebuggerTargetCommand.bind(this));

        this.applicationTarget.onReply(this.handleApplicationTargetReply.bind(this));
        this.debuggerTarget.onReply(this.handleDebuggerTargetReply.bind(this));

        // dequeue any messages we got in the meantime
        this.debuggerTarget.unpause();
    }

    private handleDebuggerTargetCommand(evt: IProtocolCommand) {
        console.log("debugger -> target", evt);
        this.applicationTarget.send(evt);
    }

    private handleApplicationTargetCommand(evt: IProtocolCommand) {
        console.log("target -> debugger", evt);
        this.debuggerTarget.send(evt);
    }

    private handleDebuggerTargetReply(evt: IProtocolError | IProtocolSuccess) {
        console.log("debugger -> target", evt);
        this.applicationTarget.send(evt);
    }

    private handleApplicationTargetReply(evt: IProtocolError | IProtocolSuccess) {
        console.log("target -> debugger", evt);
        this.debuggerTarget.send(evt);
    }

    private onDebuggerTargetError(err: Error) {
        console.error("Error on debugger transport", err);
    }

    private onApplicationTargetError(err: Error) {
        console.error("Error on debugger transport", err);
    }

    private getBrowserInspectUri(request: any) {
        const url = new URL("http://localhost" + request.url);
        const browserInspectUri = url.searchParams.get("browser");

        if (!browserInspectUri) {
            throw new Error("Can not parse debugger URL");
        }

        return browserInspectUri;
    }
}
