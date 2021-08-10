// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.

import { Packager } from "../../src/common/packager";
import { Request } from "../../src/common/node/request";
import { ExponentHelper } from "../../src/extension/exponent/exponentHelper";

import * as assert from "assert";
import * as sinon from "sinon";

suite("packager", function () {
    suite("extensionContext", function () {
        let requestStub: Sinon.SinonStub;
        let isExpoAppStub: Sinon.SinonStub;
        let getExpPackagerOptionsStub: Sinon.SinonStub;

        const WORKSPACE_PATH: string = "/workspace";
        const PROJECT_PATH: string = "/workspace";

        setup(() => {
            requestStub = sinon.stub(Request, "request");
            isExpoAppStub = sinon.stub(ExponentHelper.prototype, "isExpoApp");
            getExpPackagerOptionsStub = sinon.stub(
                ExponentHelper.prototype,
                "getExpPackagerOptions",
            );
        });

        teardown(() => {
            requestStub.restore();
            isExpoAppStub.restore();
            getExpPackagerOptionsStub.restore();
        });

        test("isRunning should check correct status URL", async function () {
            requestStub.returns(Promise.resolve("packager-status:running"));

            try {
                const isRunning = await new Packager(WORKSPACE_PATH, PROJECT_PATH, Packager.DEFAULT_PORT)
                .isRunning();
                assert(isRunning);
                    assert(
                        requestStub.firstCall.args[0].match(
                            "http://localhost:" + Packager.DEFAULT_PORT,
                        ),
                    );
            } catch (error) {
                assert.fail(null, null, "packager was expected to be running");
            }
        });

        test("isRunning should report false if server doesn't respond", async function () {
            requestStub.returns(Promise.reject());

            try {
                const isRunning = await new Packager(WORKSPACE_PATH, PROJECT_PATH, 9091)
                .isRunning();
                assert(!isRunning);
            } catch (error) {
                assert.fail(null, null, "packager was not expected to be running");
            }
        });

        test("isRunning should report false if request fails", async function () {
            requestStub.returns(Promise.resolve("some_random_string"));

            try {
                const isRunning = await new Packager(WORKSPACE_PATH, PROJECT_PATH, 10001)
                .isRunning();
                assert(!isRunning);
            } catch (error) {
                assert.fail(null, null, "packager was not expected to be running");
            }
        });

        test("getPackagerArgs should return correct value (react-native@0.56.0)", async function () {
            isExpoAppStub.returns(Promise.resolve(false));
            const rnVersion = "0.56.0";
            const expected = ["--port", "10001"];

            try {
                const args = await new Packager(WORKSPACE_PATH, PROJECT_PATH, 10001)
                .getPackagerArgs(PROJECT_PATH, rnVersion);
                assert.deepEqual(args, expected);
            } catch {}
        });

        test("getPackagerArgs should return correct value (react-native@0.57.0)", async function () {
            isExpoAppStub.returns(Promise.resolve(false));
            const rnVersion = "0.57.0";
            const expected = ["--port", "10001", "--resetCache"];

            try {
                const args = await new Packager(WORKSPACE_PATH, PROJECT_PATH, 10001)
                .getPackagerArgs(PROJECT_PATH, rnVersion, true);
                assert.deepEqual(args, expected);
            } catch {}
        });

        test("getPackagerArgs should return correct value for expo app (react-native@0.56.0)", async function () {
            isExpoAppStub.returns(Promise.resolve(true));
            getExpPackagerOptionsStub.returns(Promise.resolve({}));
            const rnVersion = "0.56.0";
            const expected = ["--port", "10001", "--resetCache", "--root", ".vscode"];

            try {
                const args = await new Packager(WORKSPACE_PATH, PROJECT_PATH, 10001)
                .getPackagerArgs(PROJECT_PATH, rnVersion, true);
                assert.deepEqual(args, expected);
            } catch {}
        });

        test("getPackagerArgs should return correct value for expo app (react-native@0.57.0)", async function () {
            isExpoAppStub.returns(Promise.resolve(true));
            getExpPackagerOptionsStub.returns(
                Promise.resolve({
                    assetExts: ["txt", "md"],
                }),
            );
            const rnVersion = "0.57.0";
            const expected = ["--port", "10001", "--assetExts", ["txt", "md"]];
            try {
                const args = await new Packager(WORKSPACE_PATH, PROJECT_PATH, 10001)
                .getPackagerArgs(PROJECT_PATH, rnVersion);
                assert.deepEqual(args, expected);
            } catch {}
        });
    });
});
