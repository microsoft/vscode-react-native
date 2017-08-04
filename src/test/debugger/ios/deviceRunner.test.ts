// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.

/* tslint:disable:no-var-keyword */
/* tslint:disable:no-var-requires */
/* tslint:disable:no-unused-variable */
// var require needed for should module to work correctly
// Note not import: We don't want to refer to shouldModule, but we need the require to occur since it modifies the prototype of Object.
require("should");
/* tslint:enable:no-unused-variable */
/* tslint:enable:no-var-requires */
/* tslint:enable:no-var-keyword */

import {Log} from "../../../common/log/log";
import net = require ("net");
import Q = require ("q");
import {DeviceRunner} from "../../../debugger/ios/deviceRunner";

interface IMockDebuggerProxy extends net.Server {
    protocolState?: number;
}

suite("deviceRunner", function() {
    suite("commonContext", function() {
        test("should complete the startup sequence when the debugger is well behaved", function(done: MochaDone) {
            // Check that when the debugger behaves nicely, we do as well
            let runner: DeviceRunner = new DeviceRunner(".");
            let port: number = 12345;
            let appPath: string = "/private/var/mobile/Applications/042F57CA-9717-4655-8349-532093FFCF44/BlankCordovaApp1.app";
            let encodedAppPath: string = "2F707269766174652F7661722F6D6F62696C652F4170706C69636174696F6E732F30343246353743412D393731372D343635352D383334392D3533323039334646434634342F426C616E6B436F72646F7661417070312E617070";
            encodedAppPath.should.equal(runner.encodePath(appPath));

            let mockDebuggerProxy: IMockDebuggerProxy = net.createServer(function (client: net.Socket): void {
                mockDebuggerProxy.close();
                client.on("data", function (data: Buffer): void {
                    let dataString: string = data.toString();
                    if (mockDebuggerProxy.protocolState % 2 === 1) {
                        // Every second message should be an acknowledgement of a send of ours
                        dataString[0].should.equal("+");
                        mockDebuggerProxy.protocolState++;
                        dataString = dataString.substring(1);
                        if (dataString === "") {
                            return;
                        }
                    }

                    dataString[0].should.equal("$");
                    let expectedResponse: string = "";
                    switch (mockDebuggerProxy.protocolState) {
                        case 0:
                            expectedResponse = "A" + encodedAppPath.length + ",0," + encodedAppPath;
                            let checksum: number = 0;
                            for (let i: number = 0; i < expectedResponse.length; ++i) {
                                checksum += expectedResponse.charCodeAt(i);
                            }
                            /* tslint:disable:no-bitwise */
                            // Some bitwise operations needed to calculate the checksum here
                            checksum = checksum & 0xFF;
                            /* tslint:enable:no-bitwise */
                            let checkstring: string = checksum.toString(16).toUpperCase();
                            if (checkstring.length === 1) {
                                checkstring = "0" + checkstring;
                            }

                            expectedResponse = "$" + expectedResponse + "#" + checkstring;
                            dataString.should.equal(expectedResponse);
                            mockDebuggerProxy.protocolState++;
                            client.write("+");
                            client.write("$OK#9A");
                            break;
                        case 2:
                            expectedResponse = "$Hc0#DB";
                            dataString.should.equal(expectedResponse);
                            mockDebuggerProxy.protocolState++;
                            client.write("+");
                            client.write("$OK#9A");
                            break;
                        case 4:
                            expectedResponse = "$c#63";
                            dataString.should.equal(expectedResponse);
                            mockDebuggerProxy.protocolState++;
                            client.write("+");
                            // Respond with empty output
                            client.write("$O#4F");
                            client.end();
                            break;
                        default:
                            break;
                    }
                });
            });
            mockDebuggerProxy.protocolState = 0;
            mockDebuggerProxy.on("error", done);

            mockDebuggerProxy.listen(port, function (): void {
                Log.logMessage("MockDebuggerProxy listening");
            });

            Q.timeout(runner.startAppViaDebugger(port, appPath, 5000), 1000).done(() => done(), done);
        });
        test("should report an error if the debugger fails for some reason", function(done: MochaDone) {
            let runner: DeviceRunner = new DeviceRunner(".");
            let port: number = 12345;
            let appPath: string = "/private/var/mobile/Applications/042F57CA-9717-4655-8349-532093FFCF44/BlankCordovaApp1.app";

            let encodedAppPath: string = "2F707269766174652F7661722F6D6F62696C652F4170706C69636174696F6E732F30343246353743412D393731372D343635352D383334392D3533323039334646434634342F426C616E6B436F72646F7661417070312E617070";
            encodedAppPath.should.equal(runner.encodePath(appPath));

            let mockDebuggerProxy: IMockDebuggerProxy = net.createServer(function (client: net.Socket): void {
                mockDebuggerProxy.close();
                client.on("data", function (data: Buffer): void {
                    let dataString: string = data.toString();
                    if (mockDebuggerProxy.protocolState % 2 === 1) {
                        // Every second message should be an acknowledgement of a send of ours
                        dataString[0].should.equal("+");
                        mockDebuggerProxy.protocolState++;
                        dataString = dataString.substring(1);
                        if (dataString === "") {
                            return;
                        }
                    }

                    dataString[0].should.equal("$");

                    let expectedResponse: string = "";
                    switch (mockDebuggerProxy.protocolState) {
                        case 0:
                            expectedResponse = "A" + encodedAppPath.length + ",0," + encodedAppPath;
                            let checksum: number = 0;
                            for (let i: number = 0; i < expectedResponse.length; ++i) {
                                checksum += expectedResponse.charCodeAt(i);
                            }
                            /* tslint:disable:no-bitwise */
                            // Some bit operations needed to calculate checksum
                            checksum = checksum & 0xFF;
                            /* tslint:enable:no-bitwise */
                            let checkstring: string = checksum.toString(16).toUpperCase();
                            if (checkstring.length === 1) {
                                checkstring = "0" + checkstring;
                            }

                            expectedResponse = "$" + expectedResponse + "#" + checkstring;
                            dataString.should.equal(expectedResponse);
                            mockDebuggerProxy.protocolState++;
                            client.write("+");
                            client.write("$OK#9A");
                            break;
                        case 2:
                            expectedResponse = "$Hc0#DB";
                            dataString.should.equal(expectedResponse);
                            mockDebuggerProxy.protocolState++;
                            client.write("+");
                            client.write("$E23#AA");
                            client.end();
                            break;
                        default:
                            break;
                    }
                });
            });
            mockDebuggerProxy.protocolState = 0;
            mockDebuggerProxy.on("error", done);

            mockDebuggerProxy.listen(port, function (): void {
                Log.logMessage("MockDebuggerProxy listening");
            });

            Q.timeout(runner.startAppViaDebugger(port, appPath, 5000), 1000).then(function (): void {
                throw new Error("Starting the app should have failed!");
            }, function (err: any): void {
                err.message.should.equal("Unable to launch application.");
            }).done(() => done(), done);
        });
    });
});