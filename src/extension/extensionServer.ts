// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.

import * as em from "../common/extensionMessaging";
import {FileSystem} from "../common/node/fileSystem";
import {Packager} from "../common/packager";
import {Log} from "../common/log";
import * as Q from "q";
import * as net from "net";
import * as vscode from "vscode";


export class ExtensionServer implements vscode.Disposable {
    private outputChannel: vscode.OutputChannel;
    private serverInstance: net.Server = null;
    private messageHandlerDictionary: { [id: number]: ((...argArray: any[]) => Q.Promise<any>) } = {};
    private reactNativePackager: Packager;

    public constructor(reactNativePackager: Packager) {
        this.outputChannel = vscode.window.createOutputChannel("React-Native");
        this.reactNativePackager = reactNativePackager;

        /* register handlers for all messages */
        this.messageHandlerDictionary[em.ExtensionMessage.START_PACKAGER] = this.startPackager;
        this.messageHandlerDictionary[em.ExtensionMessage.STOP_PACKAGER] = this.stopPackager;
        this.messageHandlerDictionary[em.ExtensionMessage.PREWARM_BUNDLE_CACHE] = this.prewarmBundleCache;
    }

    /**
     * Starts the server.
     */
    public setup(): Q.Promise<void> {

        let deferred = Q.defer<void>();

        let launchCallback = (error: any) => {
            Log.logMessage("Extension messaging server started.");
            if (error) {
                deferred.reject(error);
            } else {
                deferred.resolve(null);
            }
        };

        this.serverInstance = net.createServer(this.handleSocket.bind(this));
        this.serverInstance.on("error", this.recoverServer.bind(this));
        this.serverInstance.listen(em.getPipePath(), launchCallback);

        return deferred.promise;
    }

    /**
     * Stops the server.
     */
    public dispose(): void {
        if (this.serverInstance) {
            this.serverInstance.close();
            this.serverInstance = null;
        }
    }

    /**
     * Message handler for START_PACKAGER.
     */
    private startPackager(): Q.Promise<any> {
        return this.reactNativePackager.start(this.outputChannel);
    }

    /**
     * Message handler for STOP_PACKAGER.
     */
    private stopPackager(): Q.Promise<any> {
        return this.reactNativePackager.stop(this.outputChannel);
    }

    /**
     * Message handler for PREWARM_BUNDLE_CACHE.
     */
    private prewarmBundleCache(platform: string): Q.Promise<any> {
        return this.reactNativePackager.prewarmBundleCache(platform);
    }

    /**
     * Extension message handler.
     */
    private handleExtensionMessage(messageWithArgs: em.MessageWithArguments): Q.Promise<any> {
        let handler = this.messageHandlerDictionary[messageWithArgs.message];
        if (handler) {
            Log.logMessage("Handling message: " + em.ExtensionMessage[messageWithArgs.message]);
            return handler.apply(this, messageWithArgs.args);
        } else {
            return Q.reject("Invalid message: " + messageWithArgs.message);
        }
    }

    /**
     * Handles connections to the server.
     */
    private handleSocket(socket: net.Socket): void {
        let handleError = (e: any) => {
            Log.logError("An error ocurred. ", e);
            socket.end(em.ErrorMarker);
        };

        let dataCallback = (data: any) => {
            try {
                let messageWithArgs: em.MessageWithArguments = JSON.parse(data);
                this.handleExtensionMessage(messageWithArgs)
                    .then(result => {
                        socket.end(JSON.stringify(result));
                    })
                    .catch((e) => { handleError(e); })
                    .done();
            } catch (e) {
                handleError(e);
            }
        };

        socket.on("data", dataCallback);
    };

    /**
     * Recovers the server in case the named socket we use already exists, but no other instance of VSCode is active.
     */
    private recoverServer(error: any): void {
        let errorHandler = (e: any) => {
            /* The named socket is not used. */
            if (e.code === "ECONNREFUSED") {
                new FileSystem().removePathRecursivelyAsync(em.getPipePath())
                    .then(() => {
                        this.serverInstance.listen(em.getPipePath());
                    })
                    .done();
            }
        };

        /* The named socket already exists. */
        if (error.code === "EADDRINUSE") {
            let clientSocket = new net.Socket();
            clientSocket.on("error", errorHandler);
            clientSocket.connect(em.getPipePath(), function() {
                clientSocket.end();
            });
        }
    }
}
