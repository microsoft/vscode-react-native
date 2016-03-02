// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.

import * as Q from "q";
import * as net from "net";

/**
 * Pipe path used for communicating with the server.
 */
let WIN_ServerPipePath = "\\\\?\\pipe\\vscodereactnative";
let UNIX_ServerPipePath = "/tmp/vscodereactnative.sock";

export let ErrorMarker = "vscodereactnative-error-marker";

export let getPipePath = (): string => {
    return (process.platform === "win32" ? WIN_ServerPipePath : UNIX_ServerPipePath);
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

export interface MessageWithArguments {
    message: ExtensionMessage;
    args: any[];
}

/**
 * Sends messages to the extension.
 */
export class ExtensionMessageSender {

    public sendMessage(message: ExtensionMessage, args?: any[]): Q.Promise<any> {
        let deferred = Q.defer<any>();
        let messageWithArguments: MessageWithArguments = { message: message, args: args };
        let body = "";

        let socket = net.connect(getPipePath(), function() {
            let messageJson = JSON.stringify(messageWithArguments);
            socket.write(messageJson);
        });

        socket.on("data", function(data: any) {
            body += data;
        });

        socket.on("end", function() {
            try {
                if (body === ErrorMarker) {
                    deferred.reject(new Error("An error ocurred while handling message: " + ExtensionMessage[message]));
                } else {
                    let responseBody: any = body ? JSON.parse(body) : null;
                    deferred.resolve(responseBody);
                }
            } catch (e) {
                deferred.reject(e);
            }
        });

        return deferred.promise;
    }
}