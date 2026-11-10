// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.

import assert = require("assert");
import { EventEmitter } from "events";
import { OutputVerifier, PatternToFailure } from "../../src/common/outputVerifier";

function makeSpawnResult(stdoutLines: string[], stderrLines: string[], outcomeError?: Error) {
    const stdout = new EventEmitter() as NodeJS.ReadableStream;
    const stderr = new EventEmitter() as NodeJS.ReadableStream;
    const stdin = new EventEmitter() as NodeJS.WritableStream;
    const spawnedProcess = {} as any;

    const outcome = new Promise<void>((resolve, reject) => {
        setImmediate(() => {
            for (const line of stdoutLines) {
                stdout.emit("data", Buffer.from(line));
            }
            for (const line of stderrLines) {
                stderr.emit("data", Buffer.from(line));
            }
            if (outcomeError) {
                reject(outcomeError);
            } else {
                resolve();
            }
        });
    });

    return { stdout, stderr, stdin, spawnedProcess, outcome };
}

suite("OutputVerifier", function () {
    test("should resolve when all success patterns are found on stdout", async function () {
        const verifier = new OutputVerifier(
            () => Promise.resolve(["BUILD SUCCEEDED", "Launched"]),
            () => Promise.resolve([]),
            "iOS",
        );

        const spawnResult = makeSpawnResult(["BUILD SUCCEEDED\nLaunched app on simulator"], []);

        await verifier.process(spawnResult);
    });

    test("should reject when not all success patterns are found", async function () {
        const verifier = new OutputVerifier(
            () => Promise.resolve(["BUILD SUCCEEDED", "Launched"]),
            () => Promise.resolve([]),
            "iOS",
        );

        const spawnResult = makeSpawnResult(["BUILD SUCCEEDED"], []);

        await assert.rejects(() => verifier.process(spawnResult));
    });

    test("should reject with failure pattern error when string pattern matches stderr", async function () {
        const failurePatterns: PatternToFailure[] = [{ pattern: "BUILD FAILED", errorCode: 201 }];
        const verifier = new OutputVerifier(
            () => Promise.resolve([]),
            () => Promise.resolve(failurePatterns),
            "iOS",
        );

        const spawnResult = makeSpawnResult([], ["error: BUILD FAILED"]);

        await assert.rejects(() => verifier.process(spawnResult));
    });

    test("should reject with failure pattern error when RegExp pattern matches", async function () {
        const failurePatterns: PatternToFailure[] = [{ pattern: /error:\s+\w+/, errorCode: 202 }];
        const verifier = new OutputVerifier(
            () => Promise.resolve([]),
            () => Promise.resolve(failurePatterns),
            "Android",
        );

        const spawnResult = makeSpawnResult([], ["error: SomeException"]);

        await assert.rejects(
            () => verifier.process(spawnResult),
            (err: Error) => {
                assert.ok(
                    err.message.includes("202"),
                    "error should reference the matched error code",
                );
                return true;
            },
        );
    });

    test("should reject with process error when outcome rejects and no failure pattern matches", async function () {
        const verifier = new OutputVerifier(
            () => Promise.resolve(["SUCCESS"]),
            () => Promise.resolve([]),
            "Android",
        );

        const processError = new Error("process exited with code 1");
        const spawnResult = makeSpawnResult([], [], processError);

        await assert.rejects(() => verifier.process(spawnResult), processError);
    });

    test("should prefer failure pattern error over process error when both occur", async function () {
        const failurePatterns: PatternToFailure[] = [{ pattern: "BUILD FAILED", errorCode: 203 }];
        const verifier = new OutputVerifier(
            () => Promise.resolve([]),
            () => Promise.resolve(failurePatterns),
            "iOS",
        );

        const processError = new Error("process exited with code 1");
        const spawnResult = makeSpawnResult([], ["BUILD FAILED"], processError);

        await assert.rejects(
            () => verifier.process(spawnResult),
            (err: Error) => {
                assert.strictEqual(err, processError);
                assert.ok(
                    err.message.includes("process exited with code 1") &&
                        err.message.includes("203"),
                    "processError.message should be augmented with failure pattern error info",
                );
                return true;
            },
        );
    });

    test("should match success patterns case-insensitively", async function () {
        const verifier = new OutputVerifier(
            () => Promise.resolve(["build succeeded"]),
            () => Promise.resolve([]),
            "iOS",
        );

        const spawnResult = makeSpawnResult(["BUILD SUCCEEDED"], []);

        await verifier.process(spawnResult);
    });

    test("should check failure patterns against combined stderr and stdout", async function () {
        const failurePatterns: PatternToFailure[] = [{ pattern: "FATAL", errorCode: 204 }];
        const verifier = new OutputVerifier(
            () => Promise.resolve([]),
            () => Promise.resolve(failurePatterns),
            "iOS",
        );

        // Failure pattern appears on stdout, not stderr
        const spawnResult = makeSpawnResult(["FATAL error occurred"], []);

        await assert.rejects(() => verifier.process(spawnResult));
    });
});
