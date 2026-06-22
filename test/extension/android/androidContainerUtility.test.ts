// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.

import assert = require("assert");
import Sinon = require("sinon");
import * as androidContainerUtility from "../../../src/extension/android/androidContainerUtility";
import { AdbHelper } from "../../../src/extension/android/adb";

suite("androidContainerUtility", function () {
    let adbHelper: AdbHelper;
    let executeShellCommandStub: Sinon.SinonStub;
    setup(function () {
        adbHelper = {} as AdbHelper;
        executeShellCommandStub = Sinon.stub();
        adbHelper.executeShellCommand = executeShellCommandStub;
    });

    suite("validateAppName", function () {
        test("should resolve for valid app names", async function () {
            executeShellCommandStub.returns(Promise.resolve("ok"));
            await assert.doesNotReject(() =>
                androidContainerUtility.pull(
                    adbHelper,
                    "device1",
                    "com.example.app",
                    "/data/data/com.example.app/file.db",
                ),
            );
        });

        test("should reject app names with disallowed characters", async function () {
            await assert.rejects(
                () =>
                    androidContainerUtility.pull(
                        adbHelper,
                        "device1",
                        "com.example app!",
                        "/data/data/app/file.db",
                    ),
                /Disallowed run-as user/,
            );
        });
    });

    suite("validateFilePath", function () {
        test("should resolve for valid file paths", async function () {
            executeShellCommandStub.returns(Promise.resolve("ok"));
            await assert.doesNotReject(() =>
                androidContainerUtility.pull(
                    adbHelper,
                    "device1",
                    "com.app",
                    "/data/data/com.app/files/cert.crt",
                ),
            );
        });

        test("should reject paths containing ..", async function () {
            await assert.rejects(
                () =>
                    androidContainerUtility.pull(
                        adbHelper,
                        "device1",
                        "com.app",
                        "/data/data/../etc/passwd",
                    ),
                /Path traversal not allowed/,
            );
        });

        test("should reject paths with forbidden characters", async function () {
            await assert.rejects(
                () =>
                    androidContainerUtility.pull(
                        adbHelper,
                        "device1",
                        "com.app",
                        "/data/data/com.app/fi le",
                    ),
                /Disallowed filepath characters/,
            );
        });
    });

    suite("validateFileContent", function () {
        test("should resolve for content without quotes", async function () {
            executeShellCommandStub.returns(Promise.resolve("ok"));
            await assert.doesNotReject(() =>
                androidContainerUtility.push(
                    adbHelper,
                    "device1",
                    "com.app",
                    "/data/data/com.app/file",
                    "safe-content",
                ),
            );
        });

        test("should reject content containing double quotes", async function () {
            await assert.rejects(
                () =>
                    androidContainerUtility.push(
                        adbHelper,
                        "device1",
                        "com.app",
                        "/data/data/com.app/file",
                        'bad "content"',
                    ),
                /Disallowed escaping file content/,
            );
        });
    });

    suite("_executeCommandWithRunner", function () {
        test("should throw RunAsError for 'not an application' output", async function () {
            executeShellCommandStub.returns(Promise.resolve("run-as: package not an application"));
            const err: any = await androidContainerUtility
                .pull(adbHelper, "device1", "com.app", "/data/data/com.app/file")
                .catch(e => e);
            assert.ok(err.code === 1, "expected RunAsError with code NotAnApp");
        });

        test("should throw RunAsError for 'not debuggable' output", async function () {
            executeShellCommandStub.returns(Promise.resolve("run-as: package not debuggable"));
            const err: any = await androidContainerUtility
                .pull(adbHelper, "device1", "com.app", "/data/data/com.app/file")
                .catch(e => e);
            assert.ok(err.code === 2, "expected RunAsError with code NotDebuggable");
        });

        test("should throw generic Error for 'not permitted' output", async function () {
            executeShellCommandStub.returns(Promise.resolve("operation not permitted"));
            await assert.rejects(
                () =>
                    androidContainerUtility.pull(
                        adbHelper,
                        "device1",
                        "com.app",
                        "/data/data/com.app/file",
                    ),
                /does not support the adb shell run-as command/,
            );
        });
    });

    suite("_push fallback to su", function () {
        test("should fall back to su when run-as returns not an application", async function () {
            executeShellCommandStub
                .onFirstCall()
                .returns(Promise.resolve("run-as: package not an application"))
                .onSecondCall()
                .returns(Promise.resolve("ok"));
            await assert.doesNotReject(() =>
                androidContainerUtility.push(
                    adbHelper,
                    "device1",
                    "com.app",
                    "/data/data/com.app/file",
                    "content",
                ),
            );
            assert.ok(executeShellCommandStub.calledTwice);
            assert.ok(executeShellCommandStub.secondCall.args[1].includes("su"));
        });

        test("should rethrow original RunAsError when su also fails", async function () {
            executeShellCommandStub.returns(Promise.resolve("run-as: package not an application"));
            const err: any = await androidContainerUtility
                .push(adbHelper, "device1", "com.app", "/data/data/com.app/file", "content")
                .catch(e => e);
            assert.ok(err.code === 1);
        });
    });
});
