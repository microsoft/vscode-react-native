// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.

import * as assert from "assert";

const { preprocessText } = require("../../gulp_scripts/linePreservingPreprocessor");

suite("linePreservingPreprocessor", function () {
    const source = [
        "before();",
        "// @ifdef DEBUG",
        "debug();",
        "// @else",
        "production();",
        "// @endif",
        "after();",
        "",
    ].join("\r\n");

    test("preserves source positions in debug builds", function () {
        const result = preprocessText(source, { DEBUG: true });

        assert.strictEqual(result.length, source.length);
        assert.strictEqual(result.indexOf("debug();"), source.indexOf("debug();"));
        assert.strictEqual(result.indexOf("after();"), source.indexOf("after();"));
        assert.ok(!result.includes("production();"));
    });

    test("preserves source positions in production builds", function () {
        const result = preprocessText(source, { PROD: true });

        assert.strictEqual(result.length, source.length);
        assert.strictEqual(result.indexOf("production();"), source.indexOf("production();"));
        assert.strictEqual(result.indexOf("after();"), source.indexOf("after();"));
        assert.ok(!result.includes("debug();"));
    });
});
