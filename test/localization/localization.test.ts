// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.

import * as assert from "assert";
import { ErrorHelper } from "../../src/common/error/errorHelper";
import { InternalErrorCode } from "../../src/common/error/internalErrorCode";

suite("localizationTest", function() {
    suite("localizationContext", function () {
        const commandFailedErrorRu = ErrorHelper.getInternalError(InternalErrorCode.CommandFailed, "Команда");
        const iosDeployErrorRu = ErrorHelper.getInternalError(InternalErrorCode.IOSDeployNotFound);
        test("localize should show correct message on Russian for CommandFailed error", (done: MochaDone) => {
            assert.strictEqual(commandFailedErrorRu.message, "Ошибка при выполнении команды \"Команда\" (error code 101)");
            done();
        });

        test("localize should show correct message on Russian for iOSDeployNotFound error", (done: MochaDone) => {
            assert.strictEqual(iosDeployErrorRu.message,
                "Не удается найти ios-deploy. Установите его глобально (с помощью команды 'npm install -g ios-deploy') (error code 201)");
            done();
        });
    });
});
