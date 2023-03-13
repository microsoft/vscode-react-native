// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.

import * as assert from "assert";
import { ErrorHelper } from "../../src/common/error/errorHelper";
import { InternalErrorCode } from "../../src/common/error/internalErrorCode";

suite("localizationTest", function () {
    suite("localizationContext", function () {
        const commandFailedErrorChs = ErrorHelper.getInternalError(
            InternalErrorCode.CommandFailed,
            "IncorrectCommand",
        );
        const iosDeployErrorChs = ErrorHelper.getInternalError(InternalErrorCode.IOSDeployNotFound);
        test("localize should show correct message on ZH-CN for CommandFailed error", (done: Mocha.Done) => {
            assert.strictEqual(
                commandFailedErrorChs.message,
                "执行命令 IncorrectCommand 时出错 (error code 101)",
            );
            done();
        });

        test("localize should show correct message on ZH-CN for iOSDeployNotFound error", (done: Mocha.Done) => {
            assert.strictEqual(
                iosDeployErrorChs.message,
                "找不到 iOS 部署。请确保全局安装该部署(npm install -g ios-deploy) (error code 201)",
            );
            done();
        });
    });
});
