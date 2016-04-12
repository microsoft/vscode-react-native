// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.

import * as Q from "q";

import * as extensionMessaging from "../../common/extensionMessaging";

type ExtensionMessage = extensionMessaging.ExtensionMessage;
export type IExtensionMessageSender = extensionMessaging.IExtensionMessageSender;

export interface IMessageSent {
    message: ExtensionMessage;
    args?: any[];
}

export class FakeExtensionMessageSender implements IExtensionMessageSender {
    private messagesSent: IMessageSent[] = [];

    private messageResponse: Q.Promise<any> = Q.resolve<void>(void 0);

    public sendMessage(message: ExtensionMessage, args?: any[]): Q.Promise<any> {
        this.messagesSent.push({ message: message, args: args });
        return this.messageResponse;
    }

    public getAllMessagesSent(): IMessageSent[] {
        return this.messagesSent;
    }

    public setMessageResponse(result: Q.Promise<any>): void {
        this.messageResponse = result;
    }
}