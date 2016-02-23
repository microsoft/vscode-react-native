// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.

import * as Q from "q";
import * as http from "http";

/**
 * Message server parameters.
 */
export let ServerParams = {
    PORT: 8099,
    HOST: "127.0.0.1"
};

/**
 * Defines the messages sent to the extension.
 * Add new messages to this enum.
 */
export enum ExtensionIncomingMessage {
    START_PACKAGER,
    STOP_PACKAGER
}

/**
 * Generic interface for messages with arguments.
 */
export interface MessageWithArgs<T> {
    message: T;
    args?: any[];
}

/**
 * Sends messages to the extension.
 */
export class ExtensionMessageSender {

    public sendMessage(message: MessageWithArgs<ExtensionIncomingMessage>): Q.Promise<any> {
        let deferred = Q.defer<any>();

        let options = {
            host: ServerParams.HOST,
            port: ServerParams.PORT,
            path: "/",
            method: "POST",
            headers: { "Content-Type": "application/json" }
        };

        let responseCallback = (response: http.IncomingMessage) => {
            let body = "";

            response.on("data", function(data: any) {
                body += data;
            });

            response.on("end", function() {
                let responseBody: any = JSON.parse(body);
                console.log("Response: " + body);
                deferred.resolve(responseBody);
            });
        };

        let postRequest = http.request(options, responseCallback);
        postRequest.write(JSON.stringify(message));
        postRequest.end();

        return deferred.promise;
    }
}