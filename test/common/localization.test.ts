// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.

import * as assert from "assert";
import * as nls from "vscode-nls";
import * as path from "path";

let root = path.join(__dirname, "..", "..");

suite("localizationTest", function() {
    suite("extensionContext", function () {
        test("localize should show correct messages on Russian from errorStrings", function(done: MochaDone) {
            let localize: any = nls.config({ locale: "ru", messageFormat: nls.MessageFormat.bundle })(path.join(root, "src", "common", "error", "errorStrings.js"));
            assert.strictEqual(localize(0, null), "Ошибка при выполнении команды \"{0}\"");
            assert.strictEqual(localize(4, null),
             "Не удается найти ios-deploy. Установите его глобально (с помощью команды 'npm install -g ios-deploy')");
            done();
        });

        test("localize should show correct message on Russian from commandExecutor file", function(done: MochaDone) {
            let localize: any = nls.config({ locale: "ru", messageFormat: nls.MessageFormat.bundle })(path.join(root, "src", "common", "commandExecutor.js"));
            assert.strictEqual(localize(0, null), "Упаковщик остановлен");
            assert.strictEqual(localize(1, null), "Упаковщик не найден");
            done();
        });

        test("localize should show correct message on Russian from packager file", function(done: MochaDone) {
            let localize: any = nls.config({ locale: "ru", messageFormat: nls.MessageFormat.bundle })(path.join(root, "src", "common", "pac.js"));
            assert.strictEqual(localize(0, null), "Упаковщик остановлен");
            done();
        });
    });

});