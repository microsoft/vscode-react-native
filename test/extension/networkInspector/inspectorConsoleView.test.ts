// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.

import { InspectorConsoleView } from "../../../src/extension/networkInspector/views/inspectorConsoleView";
import { OutputChannelLogger } from "../../../src/extension/log/OutputChannelLogger";
import { URL } from "url";
import * as assert from "assert";
import * as querystring from "querystring";

suite("inspectorConsoleView", function () {
    suite("createNetworkRequestData", function () {
        const inspectorConsoleView = new InspectorConsoleView(
            OutputChannelLogger.getChannel("Network Inspector test"),
        );

        test("should return network request data with text response body", () => {
            const request = {
                headers: [
                    { key: "Accept-Encoding", value: "gzip" },
                    { key: "Connection", value: "Keep-Alive" },
                ],
                id: "6826df34-173d-4351-a7e5-d435328f2e54",
                method: "GET",
                timestamp: 1617959200269,
                url: "https://test.org",
            };
            const response = {
                headers: [
                    { key: "Content-Encoding", value: "gzip" },
                    { key: "x-frame-options", value: "deny" },
                ],
                data: "H4sIAAAAAAAA/ytJLS5RKEmtKDHkKoExjQB0Qz3xFQAAAA==",
                id: "6826df34-173d-4351-a7e5-d435328f2e54",
                index: 0,
                isMock: false,
                status: 200,
                timestamp: 1617959201269,
                totalChunks: 1,
            };

            const url = new URL(request.url);
            const networkRequestDataReference = {
                title: `%cNetwork request: ${request.method} ${
                    url ? url.host + url.pathname : "<unknown>"
                }`,
                networkRequestData: {
                    URL: request.url,
                    Method: request.method,
                    Status: response.status,
                    Duration: "1000ms",
                    "Request Headers": {
                        "Accept-Encoding": "gzip",
                        Connection: "Keep-Alive",
                    },
                    "Response Headers": {
                        "Content-Encoding": "gzip",
                        "x-frame-options": "deny",
                    },
                    "Request Body": "",
                    "Response Body": "test text1\ntest text2",
                },
            };

            const networkRequestData = (<any>inspectorConsoleView).createNetworkRequestData(
                request,
                response,
            );

            assert.deepStrictEqual(networkRequestData, networkRequestDataReference);
        });

        test("should return network request data with JSON response body", () => {
            const request = {
                headers: [
                    { key: "Accept-Encoding", value: "gzip" },
                    { key: "Connection", value: "Keep-Alive" },
                    { key: "Content-Type", value: "application/json;charset=utf-8" },
                ],
                data:
                    "eyJ0ZXN0U3RyIjoidGVzdCIsInRlc3RPYmoiOnsidGVzdE51bSI6MTMyNCwidGVzdFN0cjEiOiJ0\nZXN0MSJ9fQ==\n",
                id: "6826df34-173d-4351-a7e5-d435328f2e54",
                method: "POST",
                timestamp: 1617959200269,
                url: "https://test.org",
            };
            const response = {
                headers: [
                    { key: "server", value: "nginx" },
                    { key: "x-frame-options", value: "deny" },
                    { key: "content-type", value: "application/json; charset=utf-8" },
                ],
                data: "eyJzdWNjZXNzIjp0cnVlfQ==\n",
                id: "6826df34-173d-4351-a7e5-d435328f2e54",
                index: 0,
                isMock: false,
                status: 200,
                timestamp: 1617959201269,
                totalChunks: 1,
            };

            const url = new URL(request.url);
            const networkRequestDataReference = {
                title: `%cNetwork request: ${request.method} ${
                    url ? url.host + url.pathname : "<unknown>"
                }`,
                networkRequestData: {
                    URL: request.url,
                    Method: request.method,
                    Status: response.status,
                    Duration: "1000ms",
                    "Request Headers": {
                        "Accept-Encoding": "gzip",
                        Connection: "Keep-Alive",
                        "Content-Type": "application/json;charset=utf-8",
                    },
                    "Response Headers": {
                        server: "nginx",
                        "x-frame-options": "deny",
                        "content-type": "application/json; charset=utf-8",
                    },
                    "Request Body": {
                        testStr: "test",
                        testObj: { testNum: 1324, testStr1: "test1" },
                    },
                    "Response Body": { success: true },
                },
            };

            const networkRequestData = (<any>inspectorConsoleView).createNetworkRequestData(
                request,
                response,
            );
            assert.deepStrictEqual(networkRequestData, networkRequestDataReference);
        });

        test("should correctly process a graphQL request", () => {
            const request = {
                headers: [
                    { key: "Accept-Encoding", value: "gzip" },
                    { key: "Connection", value: "Keep-Alive" },
                    { key: "Content-Type", value: "application/json;charset=utf-8" },
                ],
                data:
                    "eyJxdWVyeSI6Ilxue1xucmF0ZXMoY3VycmVuY3k6IFwiVVNEXCIpIHtcbmN1cnJlbmN5XG5yYXRlXG59XG59XG4ifQ==",
                id: "6826df34-173d-4351-a7e5-d435328f2e54",
                method: "POST",
                timestamp: 1617959200269,
                url: "https://test.org",
            };
            const response = {
                headers: [
                    { key: "content-encoding", value: "gzip" },
                    { key: "server", value: "cloudflare" },
                    { key: "content-type", value: "application/json;charset=utf-8" },
                ],
                data:
                    "H4sIAAAAAAAA/6tWSkksSVSyqlYqSixJLVayiq5WSi4tKkrNS65UslJydHVR0gFLATnGembmxkq1sbW1AO2x5pE2AAAA\n",
                id: "6826df34-173d-4351-a7e5-d435328f2e54",
                index: 0,
                isMock: false,
                status: 200,
                timestamp: 1617959201269,
                totalChunks: 1,
            };

            const url = new URL(request.url);
            const networkRequestDataReference = {
                title: `%cNetwork request: ${request.method} ${
                    url ? url.host + url.pathname : "<unknown>"
                }`,
                networkRequestData: {
                    URL: request.url,
                    Method: request.method,
                    Status: response.status,
                    Duration: "1000ms",
                    "Request Headers": {
                        "Accept-Encoding": "gzip",
                        Connection: "Keep-Alive",
                        "Content-Type": "application/json;charset=utf-8",
                    },
                    "Response Headers": {
                        server: "cloudflare",
                        "content-encoding": "gzip",
                        "content-type": "application/json;charset=utf-8",
                    },
                    "Request Body": {
                        query: '\n{\nrates(currency: "USD") {\ncurrency\nrate\n}\n}\n',
                    },
                    "Response Body": { data: { rates: [{ currency: "AED", rate: "3.673" }] } },
                },
            };

            const networkRequestData = (<any>inspectorConsoleView).createNetworkRequestData(
                request,
                response,
            );
            assert.deepStrictEqual(networkRequestData, networkRequestDataReference);
        });

        test("should correctly process a request with URL search parameters", () => {
            const request = {
                headers: [
                    { key: "Accept-Encoding", value: "gzip" },
                    { key: "Connection", value: "Keep-Alive" },
                ],
                id: "6826df34-173d-4351-a7e5-d435328f2e54",
                method: "GET",
                timestamp: 1617959200269,
                url:
                    "https://test.org?query=query%20aTest(%24arg1%3A%20String!)%20%7B%20test(who%3A%20%24arg1)%20%7D&operationName=aTest&variables=%7B%22arg1%22%3A%22me%22%7D",
            };
            const response = {
                headers: [
                    { key: "vary", value: "Accept-Encoding" },
                    { key: "content-type", value: "application/json;charset=utf-8" },
                ],
                data: "eyJlcnJvciI6ICJ0ZXN0RXJyb3IifQ==",
                id: "6826df34-173d-4351-a7e5-d435328f2e54",
                index: 0,
                isMock: false,
                status: 400,
                timestamp: 1617959201269,
                totalChunks: 1,
            };

            const url = new URL(request.url);
            const networkRequestDataReference = {
                title: `%cNetwork request: ${request.method} ${
                    url ? url.host + url.pathname : "<unknown>"
                }`,
                networkRequestData: {
                    URL: request.url,
                    Method: request.method,
                    Status: response.status,
                    Duration: "1000ms",
                    "Request Headers": {
                        "Accept-Encoding": "gzip",
                        Connection: "Keep-Alive",
                    },
                    "Response Headers": {
                        vary: "Accept-Encoding",
                        "content-type": "application/json;charset=utf-8",
                    },
                    "Request Body": "",
                    "Request Query Parameters": {
                        operationName: "aTest",
                        query: "query aTest($arg1: String!) { test(who: $arg1) }",
                        variables: '{"arg1":"me"}',
                    },
                    "Response Body": { error: "testError" },
                },
            };

            const networkRequestData = (<any>inspectorConsoleView).createNetworkRequestData(
                request,
                response,
            );
            assert.deepStrictEqual(networkRequestData, networkRequestDataReference);
        });

        test("should correctly process a request with form data", () => {
            const request = {
                headers: [
                    { key: "Accept-Encoding", value: "gzip" },
                    { key: "Connection", value: "Keep-Alive" },
                    {
                        key: "Content-Type",
                        value: "application/x-www-form-urlencoded;charset=UTF-8",
                    },
                ],
                data: "dXNlck5hbWU9dGVzdE5hbWUmdGVzdFByb3A9dGVzdFByb3BWYWw=\n",
                id: "6826df34-173d-4351-a7e5-d435328f2e54",
                method: "POST",
                timestamp: 1617959200269,
                url: "https://test.org",
            };
            const response = {
                headers: [
                    { key: "server", value: "nginx" },
                    { key: "content-type", value: "application/json;charset=utf-8" },
                ],
                data: "eyJzdWNjZXNzIjp0cnVlfQ==\n",
                id: "6826df34-173d-4351-a7e5-d435328f2e54",
                index: 0,
                isMock: false,
                status: 200,
                timestamp: 1617959201269,
                totalChunks: 1,
            };

            const url = new URL(request.url);
            const networkRequestDataReference = {
                title: `%cNetwork request: ${request.method} ${
                    url ? url.host + url.pathname : "<unknown>"
                }`,
                networkRequestData: {
                    URL: request.url,
                    Method: request.method,
                    Status: response.status,
                    Duration: "1000ms",
                    "Request Headers": {
                        "Accept-Encoding": "gzip",
                        Connection: "Keep-Alive",
                        "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8",
                    },
                    "Response Headers": {
                        server: "nginx",
                        "content-type": "application/json;charset=utf-8",
                    },
                    "Request Body": querystring.parse("userName=testName&testProp=testPropVal"),
                    "Response Body": { success: true },
                },
            };

            const networkRequestData = (<any>inspectorConsoleView).createNetworkRequestData(
                request,
                response,
            );
            assert.deepStrictEqual(networkRequestData, networkRequestDataReference);
        });
    });
});
