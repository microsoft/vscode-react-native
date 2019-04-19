// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.

import * as assert from "assert";
import * as path from "path";
import * as fs from "fs";
import { getLoggingDirectory } from "../../src/extension/log/LogHelper";

suite("logHelper", function() {
    suite("commonContext", function() {
        const REACT_NATIVE_TOOLS_LOGS_DIR = process.env.REACT_NATIVE_TOOLS_LOGS_DIR;
        const REACT_NATIVE_TOOLS_LOGS_TIMESTAMP = process.env.REACT_NATIVE_TOOLS_LOGS_TIMESTAMP;
        setup(() => {
            delete process.env.REACT_NATIVE_TOOLS_LOGS_DIR;
            delete process.env.REACT_NATIVE_TOOLS_LOGS_TIMESTAMP;
        });

        teardown(() => {
            process.env.REACT_NATIVE_TOOLS_LOGS_DIR = REACT_NATIVE_TOOLS_LOGS_DIR;
            process.env.REACT_NATIVE_TOOLS_LOGS_TIMESTAMP = REACT_NATIVE_TOOLS_LOGS_TIMESTAMP;
        });

        test("getLoggingDirectory should return null if env variables REACT_NATIVE_TOOLS_LOGS_DIR and REACT_NATIVE_TOOLS_LOGS_TIMESTAMP is not defined", (done: MochaDone) => {
            let loggingDir = getLoggingDirectory();
            assert.strictEqual(loggingDir, null);
            done();
        });

        test("getLoggingDirectory should return null if env variables REACT_NATIVE_TOOLS_LOGS_DIR and REACT_NATIVE_TOOLS_LOGS_TIMESTAMP is defined by relative path", (done: MochaDone) => {
            process.env.REACT_NATIVE_TOOLS_LOGS_DIR = "./logs";
            process.env.REACT_NATIVE_TOOLS_LOGS_TIMESTAMP = "2019-04-19";
            let loggingDir = getLoggingDirectory();
            assert.strictEqual(loggingDir, null);
            done();
        });

        test("getLoggingDirectory should correct value if env variables REACT_NATIVE_TOOLS_LOGS_DIR and REACT_NATIVE_TOOLS_LOGS_TIMESTAMP is defined by absolute path", (done: MochaDone) => {
            process.env.REACT_NATIVE_TOOLS_LOGS_DIR = __dirname;
            process.env.REACT_NATIVE_TOOLS_LOGS_TIMESTAMP = "2019-04-19";
            let loggingDir = getLoggingDirectory();
            assert.strictEqual(loggingDir, path.join(process.env.REACT_NATIVE_TOOLS_LOGS_DIR, process.env.REACT_NATIVE_TOOLS_LOGS_TIMESTAMP));
            if (loggingDir) {
                const checkDir = fs.existsSync(loggingDir);
                if (checkDir) {
                    fs.rmdirSync(loggingDir);
                } else {
                    assert.fail("getLoggingDirectory did not created a directory");
                }
            } else {
                assert.fail("loggingDir does not have a proper value");
            }

            done();
        });
    });
});
