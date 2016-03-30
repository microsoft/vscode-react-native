// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.

import * as net from "net";
import * as Q from "q";
import * as vscode from "vscode";

import * as em from "../common/extensionMessaging";
import {HostPlatform} from "../common/hostPlatform";
import {Log} from "../common/log/log";
import {LogLevel} from "../common/log/logHelper";
import {Packager} from "../common/packager";
import {PackagerStatus, PackagerStatusIndicator} from "./packagerStatusIndicator";
import {LogCatMonitor} from "./android/logCatMonitor";
import {FileSystem} from "../common/node/fileSystem";
import {ConfigurationReader} from "../common/configurationReader";

import {WorkspaceConfiguration} from "./workspaceConfiguration";

export class ExtensionServer implements vscode.Disposable {
    private serverInstance: net.Server = null;
    private messageHandlerDictionary: { [id: number]: ((...argArray: any[]) => Q.Promise<any>) } = {};
    private reactNativePackager: Packager;
    private reactNativePackageStatusIndicator: PackagerStatusIndicator;
    private pipePath: string;
    private logCatMonitor: LogCatMonitor = null;

    public constructor(reactNativePackager: Packager, packagerStatusIndicator: PackagerStatusIndicator) {

        this.pipePath = HostPlatform.getExtensionPipePath();
        this.reactNativePackager = reactNativePackager;
        this.reactNativePackageStatusIndicator = packagerStatusIndicator;

        /* register handlers for all messages */
        this.messageHandlerDictionary[em.ExtensionMessage.START_PACKAGER] = this.startPackager;
        this.messageHandlerDictionary[em.ExtensionMessage.STOP_PACKAGER] = this.stopPackager;
        this.messageHandlerDictionary[em.ExtensionMessage.PREWARM_BUNDLE_CACHE] = this.prewarmBundleCache;
        this.messageHandlerDictionary[em.ExtensionMessage.START_MONITORING_LOGCAT] = this.startMonitoringLogCat;
        this.messageHandlerDictionary[em.ExtensionMessage.STOP_MONITORING_LOGCAT] = this.stopMonitoringLogCat;
        this.messageHandlerDictionary[em.ExtensionMessage.GET_PACKAGER_PORT] = this.getPackagerPort;
    }

    /**
     * Starts the server.
     */
    public setup(): Q.Promise<void> {

        let deferred = Q.defer<void>();

        let launchCallback = (error: any) => {
            Log.logInternalMessage(LogLevel.Info, "Extension messaging server started.");
            if (error) {
                deferred.reject(error);
            } else {
                deferred.resolve(null);
            }
        };

        this.serverInstance = net.createServer(this.handleSocket.bind(this));
        this.serverInstance.on("error", this.recoverServer.bind(this));
        this.serverInstance.listen(this.pipePath, launchCallback);

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

        this.stopMonitoringLogCat();
    }

    /**
     * Message handler for GET_PACKAGER_PORT.
     */
    private getPackagerPort(): Q.Promise<number> {
        return Q(new WorkspaceConfiguration().getPackagerPort());
    }

    /**
     * Message handler for START_PACKAGER.
     */
    private startPackager(port?: any): Q.Promise<any> {
        const portToUse = ConfigurationReader.readIntWithDefaultSync(port, new WorkspaceConfiguration().getPackagerPort());
        return this.reactNativePackager.start(portToUse)
            .then(() =>
                this.reactNativePackageStatusIndicator.updatePackagerStatus(PackagerStatus.PACKAGER_STARTED));
    }

    /**
     * Message handler for STOP_PACKAGER.
     */
    private stopPackager(): Q.Promise<any> {
        return this.reactNativePackager.stop()
            .then(() => this.reactNativePackageStatusIndicator.updatePackagerStatus(PackagerStatus.PACKAGER_STOPPED));
    }

    /**
     * Message handler for PREWARM_BUNDLE_CACHE.
     */
    private prewarmBundleCache(platform: string): Q.Promise<any> {
        return this.reactNativePackager.prewarmBundleCache(platform);
    }

    /**
     * Message handler for START_MONITORING_LOGCAT.
     */
    private startMonitoringLogCat(deviceId: string, logCatArguments: string): Q.Promise<any> {
        this.stopMonitoringLogCat(); // Stop previous logcat monitor if it's running

        // this.logCatMonitor can be mutated, so we store it locally too
        const logCatMonitor = this.logCatMonitor = new LogCatMonitor(deviceId, logCatArguments);
        logCatMonitor.start() // The LogCat will continue running forever, so we don't wait for it
            .catch(error =>
                Log.logWarning("Error while monitoring LogCat", error))
            .done();

        return Q.resolve<void>(void 0);
    }

    private stopMonitoringLogCat(): Q.Promise<void> {
        if (this.logCatMonitor) {
            this.logCatMonitor.dispose();
            this.logCatMonitor = null;
        }

        return Q.resolve<void>(void 0);
    }

    /**
     * Extension message handler.
     */
    private handleExtensionMessage(messageWithArgs: em.MessageWithArguments): Q.Promise<any> {
        let handler = this.messageHandlerDictionary[messageWithArgs.message];
        if (handler) {
            Log.logInternalMessage(LogLevel.Info, "Handling message: " + em.ExtensionMessage[messageWithArgs.message]);
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
            Log.logError(e);
            socket.end(em.ErrorMarker);
        };

        let dataCallback = (data: any) => {
            try {
                let messageWithArgs: em.MessageWithArguments = JSON.parse(data);
                em.validateMessageWithArguments(messageWithArgs);
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
                new FileSystem().removePathRecursivelyAsync(this.pipePath)
                    .then(() => {
                        this.serverInstance.listen(this.pipePath);
                    })
                    .done();
            }
        };

        /* The named socket already exists. */
        if (error.code === "EADDRINUSE") {
            let clientSocket = new net.Socket();
            clientSocket.on("error", errorHandler);
            clientSocket.connect(this.pipePath, function() {
                clientSocket.end();
            });
        }
    }
}
