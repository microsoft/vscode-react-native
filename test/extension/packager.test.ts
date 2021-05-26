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

        test("isRunning should check correct status URL", function (done) {
            requestStub.returns(Promise.resolve("packager-status:running"));

            new Packager(WORKSPACE_PATH, PROJECT_PATH, Packager.DEFAULT_PORT)
                .isRunning()
                .then(isRunning => {
                    assert(isRunning);
                    assert(
                        requestStub.firstCall.args[0].match(
                            "http://localhost:" + Packager.DEFAULT_PORT,
                        ),
                    );
                })
                .then(done, () => {
                    assert.fail(null, null, "packager was expected to be running");
                    done();
                });
        });

        test("isRunning should report false if server doesn't respond", function (done) {
            requestStub.returns(Promise.reject(void 0));

            new Packager(WORKSPACE_PATH, PROJECT_PATH, 9091)
                .isRunning()
                .then(isRunning => assert(!isRunning))
                .then(done, () => {
                    assert.fail(null, null, "packager was not expected to be running");
                    done();
                });
        });

        test("isRunning should report false if request fails", function (done) {
            requestStub.returns(Promise.resolve("some_random_string"));

            new Packager(WORKSPACE_PATH, PROJECT_PATH, 10001)
                .isRunning()
                .then(isRunning => assert(!isRunning))
                .then(done, () => {
                    assert.fail(null, null, "packager was not expected to be running");
                    done();
                });
        });

        test("getPackagerArgs should return correct value (react-native@0.56.0)", function (done) {
            isExpoAppStub.returns(Promise.resolve(false));
            const rnVersion = "0.56.0";
            const expected = ["--port", "10001"];
            new Packager(WORKSPACE_PATH, PROJECT_PATH, 10001)
                .getPackagerArgs(PROJECT_PATH, rnVersion)
                .then(args => {
                    assert.deepEqual(args, expected);
                    done();
                })
                .catch(err => {
                    done(err);
                });
        });

        test("getPackagerArgs should return correct value (react-native@0.57.0)", function (done) {
            isExpoAppStub.returns(Promise.resolve(false));
            const rnVersion = "0.57.0";
            const expected = ["--port", "10001", "--resetCache"];
            new Packager(WORKSPACE_PATH, PROJECT_PATH, 10001)
                .getPackagerArgs(PROJECT_PATH, rnVersion, true)
                .then(args => {
                    assert.deepEqual(args, expected);
                    done();
                })
                .catch(err => {
                    done(err);
                });
        });

        test("getPackagerArgs should return correct value for expo app (react-native@0.56.0)", function (done) {
            isExpoAppStub.returns(Promise.resolve(true));
            getExpPackagerOptionsStub.returns(Promise.resolve({}));
            const rnVersion = "0.56.0";
            const expected = ["--port", "10001", "--resetCache", "--root", ".vscode"];
            new Packager(WORKSPACE_PATH, PROJECT_PATH, 10001)
                .getPackagerArgs(PROJECT_PATH, rnVersion, true)
                .then(args => {
                    assert.deepEqual(args, expected);
                    done();
                })
                .catch(err => {
                    done(err);
                });
        });

        test("getPackagerArgs should return correct value for expo app (react-native@0.57.0)", function (done) {
            isExpoAppStub.returns(Promise.resolve(true));
            getExpPackagerOptionsStub.returns(
                Promise.resolve({
                    assetExts: ["txt", "md"],
                }),
            );
            const rnVersion = "0.57.0";
            const expected = ["--port", "10001", "--assetExts", ["txt", "md"]];
            new Packager(WORKSPACE_PATH, PROJECT_PATH, 10001)
                .getPackagerArgs(PROJECT_PATH, rnVersion)
                .then(args => {
                    assert.deepEqual(args, expected);
                    done();
                })
                .catch(err => {
                    done(err);
                });
        });
    });
});
