// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.

import * as net from "net";
import * as Q from "q";
import {Log} from "./log/log";
import {LogLevel} from "./log/logHelper";

import {ExtensionMessage, MessageWithArguments, ErrorMarker} from "./extensionMessaging";

export interface IInterProcessMessageSender {
    sendMessage(message: ExtensionMessage, args?: any[]): Q.Promise<any>;
}

// TODO: Refactor this class to make ExtensionMessage a generic parameter instead

/**
 * Sends messages to the extension.
 */
export class InterProcessMessageSender implements InterProcessMessageSender {
    constructor(private serverPath: string) {
    }

    public sendMessage(message: ExtensionMessage, args?: any[]): Q.Promise<any> {
        let deferred = Q.defer<any>();
        let messageWithArguments: MessageWithArguments = { message: message, args: args };
        let body = "";

        let socket = net.connect(this.serverPath, function() {
            Log.logInternalMessage(LogLevel.Info, `Connected to socket at ${this.serverPath}`);
            let messageJson = JSON.stringify(messageWithArguments);
            socket.write(messageJson);
        });

        socket.on("data", function(data: any) {
            body += data;
        });

        socket.on("error", function(data: any) {
            deferred.reject(new Error("An error ocurred while handling message: " + ExtensionMessage[message]));
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