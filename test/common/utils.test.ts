// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.
import * as assert from "assert";
import { stripJsonTrailingComma } from "../../src/common/utils";

suite("utilHelper", function () {
    suite("stripJsonTrailingComma", function () {
        test("should remove trailing comma from a JSON", (done: Mocha.Done) => {
            const strWithTrailingComma = `
            {
                "runtimeArgs": [
                    "--inspect-brk=9237",
                    "start",
                ],
                "runtimeVersion": "12.16.3",
                "port": 9237,
                "type": "node",
                "name": "some-project",
                "timeout": 300000
            }
            `;
            const strObject = stripJsonTrailingComma(strWithTrailingComma);
            const strippedStr = `{
                "runtimeArgs": [
                    "--inspect-brk=9237",
                    "start"
                ],
                "runtimeVersion": "12.16.3",
                "port": 9237,
                "type": "node",
                "name": "some-project",
                "timeout": 300000
            }`;
            const strippedStrObject = JSON.parse(strippedStr);
            assert.strictEqual(JSON.stringify(strObject), JSON.stringify(strippedStrObject));
            done();
        });

        test("should manage string contains end of string trailing comma", (done: Mocha.Done) => {
            const strWithTrailingComma = `
            {
              "version": "0.2.0",
              "configurations": [
                {
                  "name": "Debug Android",
                  "cwd": "\${workspaceFolder\}",
                  "type": "reactnative",
                  "request": "launch",
                  "platform": "android",
                  "logCatArguments": ["ReactNative", "ReactNativeJS"],
                  "env": {
                    "testvar": "(value0), (value1), (value2)"
                  }
                }
              ]
            },
            `;
            const strObject = stripJsonTrailingComma(strWithTrailingComma);
            const strippedStr = `
            {
              "version": "0.2.0",
              "configurations": [
                {
                  "name": "Debug Android",
                  "cwd": "\${workspaceFolder\}",
                  "type": "reactnative",
                  "request": "launch",
                  "platform": "android",
                  "logCatArguments": ["ReactNative", "ReactNativeJS"],
                  "env": {
                    "testvar": "(value0), (value1), (value2)"
                  }
                }
              ]
            }
            `;
            const strippedStrObject = JSON.parse(strippedStr);
            assert.strictEqual(JSON.stringify(strObject), JSON.stringify(strippedStrObject));
            done();
        });
    });
});
