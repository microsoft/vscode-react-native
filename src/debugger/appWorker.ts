// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.

import * as Q from "q";
import * as WebSocket from "ws";
import { EventEmitter } from "events";
import {Packager}  from "../common/packager";
import {ErrorHelper} from "../common/error/errorHelper";
import {Log} from "../common/log/log";
import {LogLevel} from "../common/log/logHelper";
import {ExecutionsLimiter} from "../common/executionsLimiter";
import { ForkedAppWorker } from "./forkedAppWorker";

export interface RNAppMessage {
    method: string;
    url?: string;
    // These objects have also other properties but that we don't currently use
}

function printDebuggingError(message: string, reason: any) {
    Log.logWarning(ErrorHelper.getNestedWarning(reason, `${message}. Debugging won't work: Try reloading the JS from inside the app, or Reconnect the VS Code debugger`));
}

export interface IDebuggeeWorker {
    start(): Q.Promise<any>;
    stop(): void;
    postMessage(message: RNAppMessage): void;
}

export class MultipleLifetimesAppWorker extends EventEmitter {
    /** This class will create a SandboxedAppWorker that will run the RN App logic, and then create a socket
     * and send the RN App messages to the SandboxedAppWorker. The only RN App message that this class handles
     * is the prepareJSRuntime, which we reply to the RN App that the sandbox was created successfully.
     * When the socket closes, we'll create a new SandboxedAppWorker and a new socket pair and discard the old ones.
     */
    private packagerPort: number;
    private sourcesStoragePath: string;
    private socketToApp: WebSocket;
    private singleLifetimeWorker: IDebuggeeWorker;
    private webSocketConstructor: (url: string) => WebSocket;

    private executionLimiter = new ExecutionsLimiter();

    constructor(packagerPort: number, sourcesStoragePath: string, {
        webSocketConstructor = (url: string) => new WebSocket(url),
    } = {}) {
        super();
        this.packagerPort = packagerPort;
        this.sourcesStoragePath = sourcesStoragePath;
        console.assert(!!this.sourcesStoragePath, "The sourcesStoragePath argument was null or empty");

        this.webSocketConstructor = webSocketConstructor;
    }

    public start(warnOnFailure: boolean = false): Q.Promise<any> {
        return Packager.isPackagerRunning(Packager.getHostForPort(this.packagerPort))
            .then(running => {
                if (running) {
                    return this.createSocketToApp(warnOnFailure);
                }
                throw new Error(`Cannot attach to packager. Are you sure there is a packager and it is running in the port ${this.packagerPort}? If your packager is configured to run in another port make sure to add that to the setting.json.`);
            });
    }

    public stop() {
        if (this.socketToApp) {
            this.socketToApp.removeAllListeners();
            this.socketToApp.close();
        }

        if (this.singleLifetimeWorker) {
            this.singleLifetimeWorker.stop();
        }
    }

    private startNewWorkerLifetime(): Q.Promise<void> {
        this.singleLifetimeWorker = new ForkedAppWorker(this.packagerPort, this.sourcesStoragePath, (message) => {
            this.sendMessageToApp(message);
        });
        Log.logInternalMessage(LogLevel.Info, "A new app worker lifetime was created.");
        return this.singleLifetimeWorker.start()
        .then(startedEvent => {
            this.emit("connected", startedEvent);
        });
    }

    private createSocketToApp(warnOnFailure: boolean = false): Q.Promise<void> {
        let deferred = Q.defer<void>();
        this.socketToApp = this.webSocketConstructor(this.debuggerProxyUrl());
        this.socketToApp.on("open", () => {
            this.onSocketOpened();
        });
        this.socketToApp.on("close",
            () => {
                this.executionLimiter.execute("onSocketClose.msg", /*limitInSeconds*/ 10, () => {
                    /*
                     * It is not the best idea to compare with the message, but this is the only thing React Native gives that is unique when
                     * it closes the socket because it already has a connection to a debugger.
                     * https://github.com/facebook/react-native/blob/588f01e9982775f0699c7bfd56623d4ed3949810/local-cli/server/util/webSocketProxy.js#L38
                     */
                    if (this.socketToApp._closeMessage === "Another debugger is already connected") {
                        deferred.reject(new RangeError("Another debugger is already connected to packager. Please close it before trying to debug with VSCode."));
                    }
                    Log.logMessage("Disconnected from the Proxy (Packager) to the React Native application. Retrying reconnection soon...");
                });
                setTimeout(() => {
                  this.start(true /* retryAttempt */);
                }, 100);
            });
        this.socketToApp.on("message",
            (message: any) => this.onMessage(message));
        this.socketToApp.on("error",
            (error: Error) => {
                if (warnOnFailure) {
                    Log.logWarning(ErrorHelper.getNestedWarning(error,
                        "Reconnection to the proxy (Packager) failed. Please check the output window for Packager errors, if any. If failure persists, please restart the React Native debugger."));
                }

                deferred.reject(error);
            });

        // In an attempt to catch failures in starting the packager on first attempt,
        // wait for 300 ms before resolving the promise
        Q.delay(300).done(() => deferred.resolve(void 0));
        return deferred.promise;
    }

    private debuggerProxyUrl() {
        return `ws://${Packager.getHostForPort(this.packagerPort)}/debugger-proxy?role=debugger&name=vscode`;
    }

    private onSocketOpened() {
        this.executionLimiter.execute("onSocketOpened.msg", /*limitInSeconds*/ 10, () =>
            Log.logMessage("Established a connection with the Proxy (Packager) to the React Native application"));
    }

    private onMessage(message: string) {
        function killWorker(worker: IDebuggeeWorker) {
            if (!worker) return;
            worker.stop();
            worker = null;
        }

        try {
            Log.logInternalMessage(LogLevel.Trace, "From RN APP: " + message);
            let object = <RNAppMessage>JSON.parse(message);
            if (object.method === "prepareJSRuntime") {
                // In RN 0.40 Android runtime doesn't seem to be sending "$disconnected" event
                // when user reloads an app, hence we need to try to kill it here either.
                killWorker(this.singleLifetimeWorker);
                // The MultipleLifetimesAppWorker will handle prepareJSRuntime aka create new lifetime
                this.gotPrepareJSRuntime(object);
            } else if (object.method === "$disconnected") {
                // We need to shutdown the current app worker, and create a new lifetime
                killWorker(this.singleLifetimeWorker);
            } else if (object.method) {
                // All the other messages are handled by the single lifetime worker
                this.singleLifetimeWorker.postMessage(object);
            } else {
                // Message doesn't have a method. Ignore it. This is an info message instead of warn because it's normal and expected
                Log.logInternalMessage(LogLevel.Info, "The react-native app sent a message without specifying a method: " + message);
            }
        } catch (exception) {
            printDebuggingError(`Failed to process message from the React Native app. Message:\n${message}`, exception);
        }
    }

    private gotPrepareJSRuntime(message: any): void {
        // Create the sandbox, and replay that we finished processing the message
        this.startNewWorkerLifetime().done(() => {
            this.sendMessageToApp({ replyID: parseInt(message.id, 10) });
        }, error => printDebuggingError(`Failed to prepare the JavaScript runtime environment. Message:\n${message}`, error));
    }

    private sendMessageToApp(message: any): void {
        let stringified: string = null;
        try {
            stringified = JSON.stringify(message);
            Log.logInternalMessage(LogLevel.Trace, "To RN APP: " + stringified);
            this.socketToApp.send(stringified);
        } catch (exception) {
            let messageToShow = stringified || ("" + message); // Try to show the stringified version, but show the toString if unavailable
            printDebuggingError(`Failed to send message to the React Native app. Message:\n${messageToShow}`, exception);
        }
    }
}
