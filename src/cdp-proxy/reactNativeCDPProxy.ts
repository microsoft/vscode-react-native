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
import { OutputChannelLogger } from "../extension/log/OutputChannelLogger";
import { LogLevel } from "../extension/log/LogHelper";

export class ReactNativeCDPProxy {
    private server: Server | null;
    private hostAddress: string;
    private port: number;
    private debuggerTarget: Connection;
    private applicationTarget: Connection;
    private logger: OutputChannelLogger;
    private logLevel: LogLevel;

    private readonly PROXY_LOG_TAGS = {
        DEBUGGER_COMMAND: "Command Debugger To Target",
        APPLICATION_COMMAND: "Command Target To Debugger",
        DEBUGGER_REPLY: "Reply From Debugger To Target",
        APPLICATION_REPLY: "Reply From Target To Debugger",
    };

    constructor(port: number, hostAddress: string, logLevel: LogLevel) {
        this.port = port;
        this.hostAddress = hostAddress;
        this.logger = OutputChannelLogger.getChannel("React Native Chrome Proxy", true, false, true);
        this.logLevel = logLevel;
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

        this.applicationTarget.onEnd(this.onApplicationTargetClosed.bind(this));

        // dequeue any messages we got in the meantime
        this.debuggerTarget.unpause();
    }

    private handleDebuggerTargetCommand(evt: IProtocolCommand) {
        this.logger.logWithTag(this.PROXY_LOG_TAGS.DEBUGGER_COMMAND, JSON.stringify(evt, null , 2), this.logLevel);
        this.applicationTarget.send(evt);
    }

    private handleApplicationTargetCommand(evt: IProtocolCommand) {
        this.logger.logWithTag(this.PROXY_LOG_TAGS.APPLICATION_COMMAND, JSON.stringify(evt, null , 2), this.logLevel);
        this.debuggerTarget.send(evt);
    }

    private handleDebuggerTargetReply(evt: IProtocolError | IProtocolSuccess) {
        this.logger.logWithTag(this.PROXY_LOG_TAGS.DEBUGGER_REPLY, JSON.stringify(evt, null , 2), this.logLevel);
        this.applicationTarget.send(evt);
    }

    private handleApplicationTargetReply(evt: IProtocolError | IProtocolSuccess) {
        this.logger.logWithTag(this.PROXY_LOG_TAGS.APPLICATION_REPLY, JSON.stringify(evt, null , 2), this.logLevel);
        this.debuggerTarget.send(evt);
    }

    private onDebuggerTargetError(err: Error) {
        this.logger.error("Error on debugger transport", err);
    }

    private onApplicationTargetError(err: Error) {
        this.logger.error("Error on application transport", err);
    }

    private async onApplicationTargetClosed() {
        await this.debuggerTarget.close();
    }

    private getBrowserInspectUri(request: any) {
        const url = new URL("http://localhost" + request.url);
        const browserInspectUri = url.searchParams.get("browser");

        if (!browserInspectUri) {
            throw new Error("Cannot parse debugger URL");
        }

        return browserInspectUri;
    }
}
