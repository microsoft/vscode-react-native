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
import { IncomingMessage } from "http";
import { CancellationToken } from "vscode";
import { OutputChannelLogger } from "../extension/log/OutputChannelLogger";
import { LogLevel } from "../extension/log/LogHelper";
import { DebuggerEndpointHelper } from "./debuggerEndpointHelper";
import { BaseCDPMessageHandler } from "./CDPMessageHandlers/baseCDPMessageHandler";

export class ReactNativeCDPProxy {

    private readonly PROXY_LOG_TAGS = {
        DEBUGGER_COMMAND: "Command Debugger To Target",
        APPLICATION_COMMAND: "Command Target To Debugger",
        DEBUGGER_REPLY: "Reply From Debugger To Target",
        APPLICATION_REPLY: "Reply From Target To Debugger",
    };

    private server: Server | null;
    private hostAddress: string;
    private port: number;
    private debuggerTarget: Connection | null;
    private applicationTarget: Connection | null;
    private logger: OutputChannelLogger;
    private logLevel: LogLevel;
    private debuggerEndpointHelper: DebuggerEndpointHelper;
    private CDPMessageHandler: BaseCDPMessageHandler;
    private applicationTargetPort: number;
    private browserInspectUri: string;
    private cancellationToken: CancellationToken | undefined;

    constructor(hostAddress: string, port: number, logLevel: LogLevel = LogLevel.None) {
        this.port = port;
        this.hostAddress = hostAddress;
        this.logger = OutputChannelLogger.getChannel("React Native Chrome Proxy", true, false, true);
        this.logLevel = logLevel;
        this.browserInspectUri = "";
        this.debuggerEndpointHelper = new DebuggerEndpointHelper();
    }

    public initializeServer(
        CDPMessageHandler: BaseCDPMessageHandler,
        logLevel: LogLevel,
        cancellationToken?: CancellationToken
    ): Promise<void> {
        this.logLevel = logLevel;
        this.CDPMessageHandler = CDPMessageHandler;
        this.cancellationToken = cancellationToken;

        return Server.create({ port: this.port, host: this.hostAddress })
            .then((server: Server) => {
                this.server = server;
                this.server.onConnection(this.onConnectionHandler.bind(this));
            });
    }

    public async stopServer(): Promise<void> {
        if (this.server) {
            this.server.dispose();
            this.server = null;
        }

        if (this.applicationTarget) {
            await this.applicationTarget.close();
            this.applicationTarget = null;
        }

        this.browserInspectUri = "";
        this.cancellationToken = undefined;
    }

    public setBrowserInspectUri(browserInspectUri: string): void {
        this.browserInspectUri = browserInspectUri;
    }

    public setApplicationTargetPort(applicationTargetPort: number): void {
        this.applicationTargetPort = applicationTargetPort;
    }

    private async onConnectionHandler([debuggerTarget, request]: [Connection, IncomingMessage]): Promise<void> { // eslint-disable-line @typescript-eslint/no-unused-vars
        this.debuggerTarget = debuggerTarget;

        this.debuggerTarget.pause(); // don't listen for events until the target is ready

        if (!this.browserInspectUri) {
            if (this.cancellationToken) {
                this.browserInspectUri = await this.debuggerEndpointHelper.retryGetWSEndpoint(
                    `http://localhost:${this.applicationTargetPort}`,
                    90,
                    this.cancellationToken
                );
            } else {
                this.browserInspectUri = await this.debuggerEndpointHelper.getWSEndpoint(`http://localhost:${this.applicationTargetPort}`);
            }
        }

        this.applicationTarget = new Connection(await WebSocketTransport.create(this.browserInspectUri));

        this.applicationTarget.onError(this.onApplicationTargetError.bind(this));
        this.debuggerTarget.onError(this.onDebuggerTargetError.bind(this));

        this.applicationTarget.onCommand(this.handleApplicationTargetCommand.bind(this));
        this.debuggerTarget.onCommand(this.handleDebuggerTargetCommand.bind(this));

        this.applicationTarget.onReply(this.handleApplicationTargetReply.bind(this));
        this.debuggerTarget.onReply(this.handleDebuggerTargetReply.bind(this));

        this.applicationTarget.onEnd(this.onApplicationTargetClosed.bind(this));
        this.debuggerTarget.onEnd(this.onDebuggerTargetClosed.bind(this));

        this.CDPMessageHandler?.setApplicationTarget(this.applicationTarget);
        this.CDPMessageHandler?.setDebuggerTarget(this.debuggerTarget);

        // dequeue any messages we got in the meantime
        this.debuggerTarget.unpause();
    }

    private handleDebuggerTargetCommand(event: IProtocolCommand) {
        this.logger.logWithCustomTag(this.PROXY_LOG_TAGS.DEBUGGER_COMMAND, JSON.stringify(event, null , 2), this.logLevel);
        const processedMessage = this.CDPMessageHandler.processDebuggerCDPMessage(event);

        if (processedMessage.sendBack) {
            this.debuggerTarget?.send(processedMessage.event);
        } else {
            this.applicationTarget?.send(processedMessage.event);
        }
    }

    private handleApplicationTargetCommand(event: IProtocolCommand) {
        this.logger.logWithCustomTag(this.PROXY_LOG_TAGS.APPLICATION_COMMAND, JSON.stringify(event, null , 2), this.logLevel);
        const processedMessage = this.CDPMessageHandler.processApplicationCDPMessage(event);

        if (processedMessage.sendBack) {
            this.applicationTarget?.send(processedMessage.event);
        } else {
            this.debuggerTarget?.send(processedMessage.event);
        }
    }

    private handleDebuggerTargetReply(event: IProtocolError | IProtocolSuccess) {
        this.logger.logWithCustomTag(this.PROXY_LOG_TAGS.DEBUGGER_REPLY, JSON.stringify(event, null , 2), this.logLevel);
        const processedMessage = this.CDPMessageHandler.processDebuggerCDPMessage(event);

        if (processedMessage.sendBack) {
            this.debuggerTarget?.send(processedMessage.event);
        } else {
            this.applicationTarget?.send(processedMessage.event);
        }
    }

    private handleApplicationTargetReply(event: IProtocolError | IProtocolSuccess) {
        this.logger.logWithCustomTag(this.PROXY_LOG_TAGS.APPLICATION_REPLY, JSON.stringify(event, null , 2), this.logLevel);
        const processedMessage = this.CDPMessageHandler.processApplicationCDPMessage(event);

        if (processedMessage.sendBack) {
            this.applicationTarget?.send(processedMessage.event);
        } else {
            this.debuggerTarget?.send(processedMessage.event);
        }
    }

    private onDebuggerTargetError(err: Error) {
        this.logger.error("Error on debugger transport", err);
    }

    private onApplicationTargetError(err: Error) {
        this.logger.error("Error on application transport", err);
    }

    private async onApplicationTargetClosed() {
        this.applicationTarget = null;
    }

    private async onDebuggerTargetClosed() {
        this.browserInspectUri = "";
        this.CDPMessageHandler.processDebuggerCDPMessage({method: "close"});
        this.debuggerTarget = null;
    }
}
