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
import { OutputChannelLogger } from "../extension/log/OutputChannelLogger";
import { LogLevel } from "../extension/log/LogHelper";
import { DebuggerEndpointHelper } from "./debuggerEndpointHelper";

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
    private debuggerTarget: Connection;
    private applicationTarget: Connection;
    private logger: OutputChannelLogger;
    private logLevel: LogLevel;
    private firstStop: boolean;
    private dbgEndpointHelper: DebuggerEndpointHelper;
    private applicationTargetPort: number;

    constructor(hostAddress: string, port: number, logLevel: LogLevel) {
        this.port = port;
        this.hostAddress = hostAddress;
        this.logger = OutputChannelLogger.getChannel("React Native Chrome Proxy", true, false, true);
        this.logLevel = logLevel;
        this.firstStop = true;
        this.dbgEndpointHelper = new DebuggerEndpointHelper();
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

    public setApplicationTargetPort(applicationTargetPort: number): void {
        this.applicationTargetPort = applicationTargetPort;
    }

    private async onConnectionHandler([debuggerTarget, request]: [Connection, IncomingMessage]): Promise<void> {
        this.debuggerTarget = debuggerTarget;

        this.debuggerTarget.pause(); // don't listen for events until the target is ready

        const browserInspectUri = await this.dbgEndpointHelper.getWSEndpoint(`http://localhost:${this.applicationTargetPort}`);

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
        this.logger.logWithCustomTag(this.PROXY_LOG_TAGS.DEBUGGER_COMMAND, JSON.stringify(evt, null , 2), this.logLevel);
        this.applicationTarget.send(evt);
    }

    private handleApplicationTargetCommand(evt: IProtocolCommand) {
        if (evt.method === "Debugger.paused" && this.firstStop) {
            evt.params = this.handleAppBundleFirstPauseEvent(evt);
        }
        this.logger.logWithCustomTag(this.PROXY_LOG_TAGS.APPLICATION_COMMAND, JSON.stringify(evt, null , 2), this.logLevel);
        this.debuggerTarget.send(evt);
    }

    /** Since the bundle runs inside the Node.js VM in `debuggerWorker.js` in runtime
     *  Node debug adapter need time to parse new added code source maps
     *  So we added `debugger;` statement at the start of the bundle code
     *  and wait for the adapter to receive a signal to stop on that statement
     *  and then change pause reason to `Break on start` so js-debug can process all breakpoints in the bundle and
     *  continue the code execution using `continueOnAttach` flag
     */
    private handleAppBundleFirstPauseEvent(evt: IProtocolCommand): any {
        let params: any = evt.params;
        if (params.reason && params.reason === "other") {
            this.firstStop = false;
            params.reason = "Break on start";
        }
        return params;
    }

    private handleDebuggerTargetReply(evt: IProtocolError | IProtocolSuccess) {
        this.logger.logWithCustomTag(this.PROXY_LOG_TAGS.DEBUGGER_REPLY, JSON.stringify(evt, null , 2), this.logLevel);
        this.applicationTarget.send(evt);
    }

    private handleApplicationTargetReply(evt: IProtocolError | IProtocolSuccess) {
        this.logger.logWithCustomTag(this.PROXY_LOG_TAGS.APPLICATION_REPLY, JSON.stringify(evt, null , 2), this.logLevel);
        this.debuggerTarget.send(evt);
    }

    private onDebuggerTargetError(err: Error) {
        this.logger.error("Error on debugger transport", err);
    }

    private onApplicationTargetError(err: Error) {
        this.logger.error("Error on application transport", err);
    }

    private async onApplicationTargetClosed() {
        this.firstStop = true;
        await this.debuggerTarget.close();
    }
}
