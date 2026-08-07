// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.

import assert = require("assert");
import { ScriptImporter } from "../../src/debugger/scriptImporter";

suite("scriptImporter", function () {
    let scriptImporter: ScriptImporter;

    setup(function () {
        scriptImporter = new ScriptImporter("localhost", 8081, "sources");
    });

    suite("prepareDebuggerWorkerURL", function () {
        test("returns the legacy worker URL for RN versions before 0.50", function () {
            assert.strictEqual(
                scriptImporter.prepareDebuggerWorkerURL("0.49.0"),
                "http://localhost:8081/debuggerWorker.js",
            );
        });

        test("returns the debugger UI worker URL for RN 0.50 and later", function () {
            assert.strictEqual(
                scriptImporter.prepareDebuggerWorkerURL("0.50.0"),
                "http://localhost:8081/debugger-ui/debuggerWorker.js",
            );
        });

        test("returns the debugger UI worker URL for canary RN versions", function () {
            assert.strictEqual(
                scriptImporter.prepareDebuggerWorkerURL("0.0.0"),
                "http://localhost:8081/debugger-ui/debuggerWorker.js",
            );
        });

        test("returns the debugger UI worker URL for invalid RN versions", function () {
            assert.strictEqual(
                scriptImporter.prepareDebuggerWorkerURL("not-a-semver"),
                "http://localhost:8081/debugger-ui/debuggerWorker.js",
            );
        });

        test("uses the explicit debugger worker URL path when provided", function () {
            assert.strictEqual(
                scriptImporter.prepareDebuggerWorkerURL("0.55.4", ""),
                "http://localhost:8081/debuggerWorker.js",
            );
            assert.strictEqual(
                scriptImporter.prepareDebuggerWorkerURL("0.55.4", "new-debugger/"),
                "http://localhost:8081/new-debugger/debuggerWorker.js",
            );
            assert.strictEqual(
                scriptImporter.prepareDebuggerWorkerURL("0.49.0", "debugger-ui/"),
                "http://localhost:8081/debugger-ui/debuggerWorker.js",
            );
        });
    });

    suite("overridePackagerPort", function () {
        test("replaces localhost URL port without changing query string", function () {
            assert.strictEqual(
                (<any>scriptImporter).overridePackagerPort(
                    "http://localhost:19000/index.bundle?platform=ios&dev=true&minify=false",
                ),
                "http://localhost:8081/index.bundle?platform=ios&dev=true&minify=false",
            );
        });
    });
});
