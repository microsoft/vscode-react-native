// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.

import { OutputChannelLogger } from "../../../src/extension/log/OutputChannelLogger";
import { LogLevel } from "../../../src/extension/log/LogHelper";
import { RequestBodyFormatter } from "../../../src/extension/networkInspector/requestBodyFormatters/requestBodyFormatter";
import { Response, Request } from "../../../src/extension/networkInspector/networkMessageData";
import * as sinon from "sinon";
import * as assert from "assert";

suite("requestBodyFormatter", function () {
    suite("formatBody", function () {
        let testLogger = OutputChannelLogger.getChannel("Network Inspector test");
        let loggedOutput: Array<string> = [];
        sinon.stub(testLogger, "log", function (message: string, level: LogLevel) {
            loggedOutput.push(message);
        });
        const requestBodyFormatter = new RequestBodyFormatter(testLogger);

        setup(() => {
            loggedOutput = [];
        });

        test("should return text data and print warnings via logger", () => {
            const response: Response = {
                headers: [
                    { key: "Content-Encoding", value: "gzip" },
                    { key: "Content-Type", value: "application/json;charset=utf-8" },
                ],
                data: "H4sIAAAAAAAA/6tWSkksSVSyUihJLS6pBQAeHWwqDgAAAA==",
                id: "6826df34-173d-4351-a7e5-d435328f2e54",
                index: 0,
                isMock: false,
                status: 200,
                timestamp: 1617959201269,
                totalChunks: 1,
                reason: "",
                insights: null,
            };

            const formattedBodyRes = requestBodyFormatter.formatBody(response);
            assert.strictEqual(loggedOutput[0].includes("GraphQLFormatter"), true);
            assert.strictEqual(loggedOutput[1].includes("JSONFormatter"), true);
            assert.strictEqual(formattedBodyRes, '{"data": test}');
        });

        test("should parse JSON objects and return an array of objects", () => {
            const request: Request = {
                headers: [
                    { key: "Accept-Encoding", value: "gzip" },
                    { key: "Content-Type", value: "application/json;charset=utf-8" },
                ],
                data: "eyJkYXRhU3RyIjogInRlc3QifQp7ImRhdGFOdW0iOiAxMjN9CnsiZGF0YUFyciI6IFsxLCAyXX0=",
                id: "6826df34-173d-4351-a7e5-d435328f2e54",
                timestamp: 1617959201269,
                url: "https://test.org",
                method: "POST",
            };

            const formattedBodyReference = [
                { dataStr: "test" },
                { dataNum: 123 },
                { dataArr: [1, 2] },
            ];

            const formattedBodyRes = requestBodyFormatter.formatBody(request);
            assert.deepStrictEqual(formattedBodyRes, formattedBodyReference);
        });
    });
});
