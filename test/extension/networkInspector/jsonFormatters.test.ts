// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.

import assert = require("assert");
import proxyquire = require("proxyquire");

suite("JSON body formatters", function () {
    const stubs = {
        "./requestBodyFormatter": {
            decodeBody: (container: { data: string }) => container.data,
        },
    };
    const { JSONFormatter } = proxyquire.noCallThru()(
        "../../../src/extension/networkInspector/requestBodyFormatters/jsonFormatter",
        stubs,
    );
    const { GraphQLFormatter } = proxyquire.noCallThru()(
        "../../../src/extension/networkInspector/requestBodyFormatters/graphQLFormatter",
        stubs,
    );
    const jsonFormatter = new JSONFormatter(null);
    const graphQLFormatter = new GraphQLFormatter(null);
    const formatters = [
        { name: "JSON request", format: jsonFormatter.formatRequest.bind(jsonFormatter) },
        { name: "JSON response", format: jsonFormatter.formatResponse.bind(jsonFormatter) },
        {
            name: "GraphQL response",
            format: graphQLFormatter.formatResponse.bind(graphQLFormatter),
        },
    ];

    for (const { name, format } of formatters) {
        suite(name, function () {
            const cases = [
                { name: "consecutive objects", body: '{"a":1}\n{"b":2}' },
                { name: "blank lines", body: '\n{"a":1}\n\n{"b":2}' },
                { name: "whitespace-only lines", body: '{"a":1}\n \t \n{"b":2}' },
                { name: "trailing LF", body: '{"a":1}\n{"b":2}\n' },
                { name: "trailing CRLF", body: '{"a":1}\r\n \t\r\n{"b":2}\r\n' },
            ];
            for (const { name, body } of cases) {
                test(`parses ${name}`, () => {
                    assert.deepStrictEqual(format({ data: body }, "application/json"), [
                        { a: 1 },
                        { b: 2 },
                    ]);
                });
            }

            test("preserves a single pretty-printed document with a trailing newline", () => {
                assert.deepStrictEqual(format({ data: '{\n  "a": 1\n}\n' }, "application/json"), {
                    a: 1,
                });
            });

            test("rejects malformed nonblank lines", () => {
                assert.throws(
                    () => format({ data: '{"a":1}\n \n{invalid}\n' }, "application/json"),
                    SyntaxError,
                );
            });
        });
    }
});
