// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.

import * as assert from "assert";
import * as path from "path";
import * as cp from "child_process";
import * as Q from "q";

const changelogsDir = path.join(__dirname, "resources", "changelogs");
const changelogs = {
    empty: path.join(changelogsDir, "empty.md"),
    oneVersion: path.join(changelogsDir, "one-version.md"),
    twoIdenticalVersions: path.join(changelogsDir, "two-identical-versions.md"),
    severalVersions: path.join(changelogsDir, "several-versions.md"),
    emptyChangelogForVersion: path.join(changelogsDir, "empty-changelog-for-version.md"),
    includesReference: path.join(changelogsDir, "includes-reference.md"),
};

const scriptPath = path.join(__dirname, "..", "..", "tools", "get-changelog.js");

interface Result {
    code: number;
    output: string;
}

async function run(args: string[]) {
    args = [scriptPath].concat(args);
    const cmd = cp.spawn("node", args);
    let defer = Q.defer<Result>();
    let output = "";
    const gatherOutput = (data: Buffer | string) => output += data;
    cmd.stdout.on("data", gatherOutput);
    cmd.stderr.on("data", gatherOutput);
    cmd.on("close", (code) => {
        defer.resolve({ code, output });
    });
    return defer.promise;
}

async function check(args: string[], expectedOutput: string, codeIsZero: boolean) {
    const result = await run(args);
    assert.equal(result.output.trim(), expectedOutput);
    codeIsZero ? assert.equal(result.code, 0) : assert.notEqual(result.code, 0);
}

async function shouldSuccess(args: string[], expectedOutput: string) {
    await check(args, expectedOutput, true);
}

async function shouldFail(args: string[], expectedOutput: string) {
    await check(args, expectedOutput, false);
}

suite("tools", () => {
    suite("get-changelog", () => {
        test("should throw error if path to the changelog file is not specified", async () => {
            await shouldFail([], "Please, specify path to the changelog file");
        });
        test("should throw error if version parameter is not specified", async () => {
            await shouldFail(["/some/path"], "Please, specify version");
        });
        test("should throw error if file is empty", async () => {
            await shouldFail([changelogs.empty, "1.0.0"], "No version markers were found in the changelog file");
        });
        test("should throw error if specified version isn't mentioned in the file", async () => {
            await shouldFail([changelogs.oneVersion, "0.0.0"], "No version markers were found in the changelog file that would match specified version");
        });
        test("should return version changelog if specified version is in the file and it is first version", async () => {
            await shouldSuccess([changelogs.oneVersion, "1.0.0"], "* some text1.0.0");
            await shouldSuccess([changelogs.severalVersions, "1.0.0"], "* some text1.0.0");
            await shouldSuccess([changelogs.severalVersions, "1.0.1"], "* some text1.0.1");
            await shouldSuccess([changelogs.severalVersions, "2.0.0"], "* some text2.0.0");
        });
        test("should throw error if changelog is empty for version", async () => {
            await shouldFail([changelogs.emptyChangelogForVersion, "1.0.1"], "No changelog content found or empty between 1.0.1 and previous version");
        });
    });
});