// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.

import * as net from "net";
import * as Q from "q";
import {Log} from "./log/log";
import {LogLevel} from "./log/logHelper";

import {ExtensionMessage, MessageWithArguments, MessagingChannel, ErrorMarker} from "./extensionMessaging";

export interface IExtensionMessageSender {
    sendMessage(message: ExtensionMessage, args?: any[]): Q.Promise<any>;
}

/**
 * Sends messages to the extension.
 */
export class ExtensionMessageSender implements IExtensionMessageSender {
    constructor(private projectRootPath: string) {
    }

    public sendMessage(message: ExtensionMessage, args?: any[]): Q.Promise<any> {
        let deferred = Q.defer<any>();
        let messageWithArguments: MessageWithArguments = { message: message, args: args };
        let body = "";

        let pipePath = new MessagingChannel(this.projectRootPath).getPath();
        let socket = net.connect(pipePath, function() {
            Log.logInternalMessage(LogLevel.Info, `Connected to socket at ${pipePath}`);
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