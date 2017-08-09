// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.

import { Packager } from "../../common/packager";
import { Request } from "../../common/node/request";

import * as assert from "assert";
import * as sinon from "sinon";

suite("packager", function () {

    let requestStub: Sinon.SinonStub;

    setup(() => {
        requestStub = sinon.stub(Request, "request");
    });

    teardown(() => {
        requestStub.restore();
    });

    test("isRunning should check correct status URL", function (done) {
        requestStub.returns(Promise.resolve("packager-status:running"));

        new Packager("/workspace", "/workspace", Packager.DEFAULT_PORT)
            .isRunning()
            .then(isRunning => {
                assert(isRunning);
                assert(requestStub.firstCall.args[0].match("http://localhost:" + Packager.DEFAULT_PORT));
            })
            .then(done, () => {
                assert.fail(null, null, "packager was expected to be running");
                done();
            });
    });

    test("isRunning should report false if server doesn't respond", function (done) {
        requestStub.returns(Promise.reject(void 0));

        new Packager("/workspace", "/workspace", 9091)
            .isRunning()
            .then(isRunning => assert(!isRunning))
            .then(done, () => {
                assert.fail(null, null, "packager was not expected to be running");
                done();
            });
    });

    test("isRunning should report false if request fails", function (done) {
        requestStub.returns(Promise.resolve("some_random_string"));

        new Packager("/workspace", "/workspace", 10001)
            .isRunning()
            .then(isRunning => assert(!isRunning))
            .then(done, () => {
                assert.fail(null, null, "packager was not expected to be running");
                done();
            });
    });
});
