// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.

import {MessagingHelper} from "../../src/common/extensionMessaging";

import {RemoteExtension} from "../../src/common/remoteExtension";

import * as assert from "assert";
import * as Q from "q";
import * as rpc from "noice-json-rpc";
import * as WebSocket from "ws";
import WebSocketServer = WebSocket.Server;

let mockServer: WebSocketServer;

suite("extensionMessaging", function() {
    suite("commonContext", function() {
        const projectRootPath = "/myPath";
        const port: string = MessagingHelper.getPath(projectRootPath);
        setup(function () {
            mockServer = new WebSocketServer({port: <any>port});
            let api = new rpc.Server(mockServer).api();
            api.Extension.expose({
                stopMonitoringLogcat: function () {
                    return {data: "STOP_MONITORING_LOGCAT"};
                },
            });
        });

        teardown(function() {
            if (mockServer) {
                mockServer.close();
            }
        });

        test("should successfully send a message", function(done: MochaDone) {
            const sender = RemoteExtension.atProjectRootPath(projectRootPath);
            mockServer.on("error", done);

            Q({})
                .then(function() {
                    return sender.stopMonitoringLogcat()
                        .then((message: any) => {
                            return message.data;
                        });
                })
                .then(function(message) {
                    assert.equal(message, "STOP_MONITORING_LOGCAT");
                }).done(() => done(), done);
        });
    });
});
