// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.

import * as assert from "assert";
import { promises as fs } from "fs";
import * as os from "os";
import * as path from "path";
import * as proxyquire from "proxyquire";

suite("checkEnvironment", function () {
    suite("basicCheck", function () {
        const commandExistsStub = { sync: () => true };
        const abc = proxyquire("../../src/extension/services/validationService/util", {
            "command-exists": commandExistsStub,
        }) as typeof import("../../src/extension/services/validationService/util");

        console.log(abc);

        test("command should exist", async () => {
            commandExistsStub.sync = () => true;
            assert.deepStrictEqual(await abc.basicCheck({ command: "whatever" }), {
                exists: true,
                versionCompare: undefined,
            });
        });

        test("command should not exist", async () => {
            commandExistsStub.sync = () => false;
            assert.deepStrictEqual(await abc.basicCheck({ command: "whatever" }), {
                exists: false,
                versionCompare: undefined,
            });
        });

        test("command should check version", async () => {
            commandExistsStub.sync = () => true;

            let wasExecuted = false;

            assert.deepStrictEqual(
                await abc.basicCheck({
                    command: "whatever",
                    getVersion: async () => ((wasExecuted = true), "0.0.1"),
                }),
                {
                    exists: true,
                    versionCompare: 0,
                },
            );

            assert(wasExecuted);
        });

        test("command should compare version lt", async () => {
            commandExistsStub.sync = () => true;

            assert.deepStrictEqual(
                await abc.basicCheck({
                    command: "whatever",
                    getVersion: async () => "0.0.1",
                    versionRange: ">0.0.1",
                }),
                {
                    exists: true,
                    versionCompare: -1,
                },
            );
        });

        test("command should compare version gt", async () => {
            commandExistsStub.sync = () => true;

            assert.deepStrictEqual(
                await abc.basicCheck({
                    command: "whatever",
                    getVersion: async () => "0.0.1",
                    versionRange: "<0.0.1",
                }),
                {
                    exists: true,
                    versionCompare: 1,
                },
            );
        });

        test("command should compare version eq", async () => {
            commandExistsStub.sync = () => true;

            assert.deepStrictEqual(
                await abc.basicCheck({
                    command: "whatever",
                    getVersion: async () => "0.0.1",
                    versionRange: "=0.0.1",
                }),
                {
                    exists: true,
                    versionCompare: 0,
                },
            );
        });
    });

    suite("envTest", async function () {
        const envTest = await import(
            "../../src/extension/services/validationService/checks/env"
        ).then(it => it.androidHome.exec);

        const envVars = {
            ANDROID_HOME: process.env.ANDROID_HOME,
        };

        const setEnv = (arg: string) => {
            Object.keys(envVars).forEach(it => {
                process.env[it] = arg;
            });
        };
        const restoreEnv = () => {
            Object.keys(envVars).forEach(it => {
                process.env[it] = envVars[it];
            });
        };

        test("should succeed on correct env", async () => {
            const tempdir = await fs.mkdtemp(path.join(os.tmpdir(), "foo"));
            setEnv(tempdir);

            const result = await envTest();

            assert(result.status === "success");

            restoreEnv();
        });

        test("should fail on non existant path", async () => {
            setEnv("/non-existant-path-abcd");

            const result = await envTest();

            assert(result.status === "failure");

            restoreEnv();
        });

        test("should succeed on path with env values", async () => {
            const varName = "some-weired-variable-abcd";
            const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "foo"));
            await fs.mkdir(path.join(tempDir, "bar"));

            process.env[varName] = "bar";

            setEnv(`${tempDir}/%${varName}%`);

            const result = await envTest();

            assert(result.status === "partial-success");

            restoreEnv();
            delete process.env[varName];
        });
    });
});
