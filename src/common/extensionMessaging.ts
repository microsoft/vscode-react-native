// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.

import * as Q from "q";
import * as http from "http";

/**
 * Message server parameters.
 */
export let ServerDefaultParams = {
    PORT: 8099,
    HOST: "127.0.0.1"
};

/**
 * Defines the messages sent to the extension.
 * Add new messages to this enum.
 */
export enum ExtensionMessage {
    START_PACKAGER,
    STOP_PACKAGER,
    PREWARM_BUNDLE_CACHE
}

/**
 * Sends messages to the extension.
 */
export class ExtensionMessageSender {

    public sendMessage(message: ExtensionMessage, args?: any[], port?: number): Q.Promise<any> {
        let deferred = Q.defer<any>();

        let options = {
            host: ServerDefaultParams.HOST,
            port: port || ServerDefaultParams.PORT,
            path: "/" + ExtensionMessage[message],
            method: "POST",
            headers: { "Content-Type": "application/json" }
        };

        let responseCallback = (response: http.IncomingMessage) => {
            let body = "";

            response.on("data", function(data: any) {
                body += data;
            });

            response.on("end", function() {
                try {
                    let responseBody: any = body ? JSON.parse(body) : null;
                    deferred.resolve(responseBody);
                } catch (e) {
                    deferred.reject(e);
                }
            });
        };

        let postRequest = http.request(options, responseCallback);
        if (args) {
            postRequest.write(JSON.stringify(args));
        }
        postRequest.end();

        return deferred.promise;
    }
}