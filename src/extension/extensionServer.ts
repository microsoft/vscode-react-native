// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.

import * as em from "../common/extensionMessaging";
import * as http from "http";
import * as vscode from "vscode";
import * as Q from "q";

export class ExtensionServer implements vscode.Disposable {

    private serverInstance: http.Server = null;

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

        this.serverInstance = http.createServer(requestHandler);
        this.serverInstance.listen(em.ServerParams.PORT, null, null, launchCallback);

        return deferred.promise;
    }

    /**
     * Stops the server.
     */
    public dispose(): void {
        if (this.serverInstance) {
            this.serverInstance.close();
        }
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
            let extensionMessage: em.MessageWithArgs<em.ExtensionIncomingMessage> = JSON.parse(body);
            console.log("Received message: " + extensionMessage.message);
            this.handleExtensionMessage(extensionMessage)
                .then(result => {
                    response.writeHead(200, "OK", { "Content-Type": "application/json" });
                    response.end(JSON.stringify(result));
                })
                .done();
        });
    }

    /**
     * Extension message handler.
     */
    private handleExtensionMessage(messageWithArgs: em.MessageWithArgs<em.ExtensionIncomingMessage>): Q.Promise<any> {
        let deferred = Q.defer<any>();
        /* handle each extension message here and return the result */
        switch (messageWithArgs.message) {
            case em.ExtensionIncomingMessage.START_PACKAGER:
                /* TODO */
                break;
            case em.ExtensionIncomingMessage.STOP_PACKAGER:
                /* TODO */
                break;
            default:
                throw new Error("Invalid message: " + messageWithArgs.message);
        }

        return deferred.promise;
    }
}
