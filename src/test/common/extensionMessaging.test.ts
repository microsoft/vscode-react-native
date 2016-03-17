// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.

import {HostPlatform} from "../../common/hostPlatform";

import {
    ExtensionMessage,
    ExtensionMessageSender
} from "../../common/extensionMessaging";

import * as assert from "assert";
import * as net from "net";
import * as sinon from "sinon";
import * as Q from "q";

suite("extensionMessaging", function() {
    suite("commonContext", function() {
        teardown(function() {
            if (HostPlatform.getExtensionPipePath.hasOwnProperty("restore")) {
                (<any>HostPlatform.getExtensionPipePath).restore();
            }
        });

        test("should successfully send a message", function(done: MochaDone) {
            let port: string = HostPlatform.getExtensionPipePath();
            let mockServer: net.Server = net.createServer(function(client: net.Socket): void {
                mockServer.close();
                client.on("data", function(data: Buffer) {
                    let messageData: any = JSON.parse(data.toString("utf8"));
                    client.end();

                    assert.equal(messageData.message, ExtensionMessage.START_PACKAGER);
                });
            });

            mockServer.on("error", done);

            mockServer.listen(port);

            sinon.stub(HostPlatform, "getExtensionPipePath", function() {
                return port;
            });

            const sender = new ExtensionMessageSender();

            Q({})
                .then(function() {
                    return sender.sendMessage(ExtensionMessage.START_PACKAGER);
                }).done(() => done(), done);
        });

        test("should successfully send a message with args", function(done: MochaDone) {
            let port: string = HostPlatform.getExtensionPipePath();
            let args = ["android"];
            let mockServer: net.Server = net.createServer(function(client: net.Socket): void {
                mockServer.close();
                client.on("data", function(data: Buffer) {
                    let messageData: any = JSON.parse(data.toString("utf8"));
                    client.end();

                    assert.equal(messageData.message, ExtensionMessage.PREWARM_BUNDLE_CACHE);
                    assert.deepEqual(messageData.args, args);
                });
            });

            mockServer.on("error", done);

            mockServer.listen(port);

            sinon.stub(HostPlatform, "getExtensionPipePath", function() {
                return port;
            });

            const sender = new ExtensionMessageSender();

            Q({})
                .then(function() {
                    return sender.sendMessage(ExtensionMessage.PREWARM_BUNDLE_CACHE, args);
                }).done(() => done(), done);
        });

        test("should reject on socket error", function(done: MochaDone) {
            const sender = new ExtensionMessageSender();

            Q({})
                .then(function() {
                    return sender.sendMessage(ExtensionMessage.PREWARM_BUNDLE_CACHE);
                })
                .then(function() {
                    assert.fail("sendMessage should reject on socket error");
                })
                .catch(function(reason: any) {
                    let expectedErrorMessage = "An error ocurred while handling message: PREWARM_BUNDLE_CACHE";
                    assert.equal(reason.message, expectedErrorMessage);
                })
                .done(() => done(), done);
        });
    });
});