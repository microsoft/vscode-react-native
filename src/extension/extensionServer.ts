// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.

import * as em from "../common/extensionMessaging";
import * as http from "http";
import {ILaunchArgs} from "../common/launchArgs";
import {Packager} from "../common/packager";
import * as Q from "q";
import {SettingsHelper} from "./settingsHelper";
import * as vscode from "vscode";


export class ExtensionServer implements vscode.Disposable {

    private serverInstance: http.Server = null;
    private messageHandlerDictionary: { [id: number]: ((...argArray: any[]) => Q.Promise<any>) } = {};
    private reactNativePackager: Packager;

    public constructor(reactNativePackager: Packager) {
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

        let requestHandler = (request: http.IncomingMessage, response: http.ServerResponse) => {
            this.handleIncomingMessage(request, response);
        };

        let launchCallback = (error: any) => {
            if (error) {
                deferred.reject(error);
            } else {
                deferred.resolve(null);
            }
        };

        let port = em.ServerDefaultParams.PORT;
        SettingsHelper.readLaunchJson()
            .then((launchJson: any) => {
                if (launchJson) {
                    /* take the fist configuration that specifies the port */
                    port = (<Array<ILaunchArgs>>launchJson.configurations)
                        .filter((configuration: ILaunchArgs, index: number, array: any[]) => {
                            return !!configuration.internalExtensionPort;
                        })[0].internalExtensionPort;
                }
            })
            .fail(() => { /* using default port in case of any error */ })
            .done(() => {
                this.serverInstance = http.createServer(requestHandler);
                this.serverInstance.listen(port, null, null, launchCallback);
            });

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
        return this.reactNativePackager.start(vscode.window.createOutputChannel("React-Native"));
    }

    /**
     * Message handler for STOP_PACKAGER.
     */
    private stopPackager(): Q.Promise<any> {
        return this.reactNativePackager.stop(vscode.window.createOutputChannel("React-Native"));
    }

    /**
     * Message handler for PREWARM_BUNDLE_CACHE.
     */
    private prewarmBundleCache(platform: string): Q.Promise<any> {
        console.log("Prewarming bundle cache for platform: " + platform);
        return this.reactNativePackager.prewarmBundleCache(platform);
    }

    /**
     * HTTP request handler.
     */
    private handleIncomingMessage(message: http.IncomingMessage, response: http.ServerResponse): void {
        let body = "";
        message.on("data", (chunk: string) => {
            body += chunk;
        });

        message.on("end", () => {
            let args: any[];
            if (body) {
                args = JSON.parse(body);
            }
            let extensionMessage: em.ExtensionMessage = <any>em.ExtensionMessage[<any>message.url.substring(1)];

            this.handleExtensionMessage(extensionMessage, args)
                .then(result => {
                    response.writeHead(200, "OK", { "Content-Type": "application/json" });
                    response.end(JSON.stringify(result));
                })
                .catch(() => {
                    response.writeHead(404, "Not Found");
                    response.end();
                })
                .done();
        });
    }

    /**
     * Extension message handler.
     */
    private handleExtensionMessage(message: em.ExtensionMessage, args?: any[]): Q.Promise<any> {
        let handler = this.messageHandlerDictionary[message];
        if (handler) {
            return handler.apply(this, args);
        } else {
            return Q.reject("Invalid message: " + message);
        }
    }
}
