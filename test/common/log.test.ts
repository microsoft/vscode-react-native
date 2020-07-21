// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.

import * as assert from "assert";
import * as fs from "fs";
import * as path from "path";
import { getLoggingDirectory } from "../../src/extension/log/LogHelper";

suite("logHelper", function () {
    suite("commonContext", function () {
        const REACT_NATIVE_TOOLS_LOGS_DIR = process.env.REACT_NATIVE_TOOLS_LOGS_DIR;
        suiteSetup(() => {
            delete process.env.REACT_NATIVE_TOOLS_LOGS_DIR;
        });

        suiteTeardown(() => {
            process.env.REACT_NATIVE_TOOLS_LOGS_DIR = REACT_NATIVE_TOOLS_LOGS_DIR;
        });

        test("getLoggingDirectory should return null if env variable REACT_NATIVE_TOOLS_LOGS_DIR is not defined", (done: MochaDone) => {
            const loggingDir = getLoggingDirectory();
            assert.strictEqual(loggingDir, null);
            done();
        });

        test("getLoggingDirectory should return null if env variable REACT_NATIVE_TOOLS_LOGS_DIR is defined by relative path", (done: MochaDone) => {
            process.env.REACT_NATIVE_TOOLS_LOGS_DIR = "./logs";
            const loggingDir = getLoggingDirectory();
            assert.strictEqual(loggingDir, null);
            done();
        });

        test("getLoggingDirectory should return correct value if env variable REACT_NATIVE_TOOLS_LOGS_DIR is defined by absolute path", (done: MochaDone) => {
            process.env.REACT_NATIVE_TOOLS_LOGS_DIR = path.join(__dirname, "testFolder");
            const loggingDir = getLoggingDirectory();
            assert.strictEqual(loggingDir, process.env.REACT_NATIVE_TOOLS_LOGS_DIR);
            if (loggingDir) {
                const checkDir = fs.existsSync(loggingDir);
                if (checkDir) {
                    fs.rmdirSync(loggingDir);
                } else {
                    assert.fail("getLoggingDirectory did not create a directory");
                }
            } else {
                assert.fail(`${loggingDir} is not a correct path`);
            }
            done();
        });
    });
});
