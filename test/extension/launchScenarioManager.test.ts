// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.

import * as fs from "fs";
import * as path from "path";
import { LaunchScenariosManager } from "../../src/extension/launchScenariosManager";
import * as assert from "assert";

suite("LaunchScenarioManager", function () {
    const tmpPath = path.resolve(__dirname, "..", "resources", "tmp");
    const launchPath = path.resolve(tmpPath, ".vscode", "launch.json");
    const launchContent = {
        version: "0.2.0",
        configurations: [
            {
                name: "Debug Android",
                cwd: "${workspaceFolder}",
                type: "reactnative",
                request: "launch",
                platform: "android",
                target: "simulator",
            },
            {
                name: "Debug Android (Hermes) - Experimental",
                cwd: "${workspaceFolder}",
                type: "reactnativedirect",
                request: "launch",
                platform: "android",
                env: {
                    env1: "value1",
                    env2: "value2",
                },
            },
            {
                name: "Attach to Hermes application - Experimental",
                cwd: "${workspaceFolder}",
                type: "reactnativedirect",
                request: "attach",
            },
            {
                name: "Debug iOS",
                cwd: "${workspaceFolder}",
                type: "reactnative",
                request: "launch",
                platform: "ios",
            },
            {
                name: "Attach to packager",
                cwd: "${workspaceFolder}",
                type: "reactnative",
                request: "attach",
            },
            {
                name: "Debug in Exponent",
                cwd: "${workspaceFolder}",
                type: "reactnative",
                request: "launch",
                platform: "exponent",
            },
            {
                name: "Debug in Exponent (LAN)",
                cwd: "${workspaceFolder}",
                type: "reactnative",
                request: "launch",
                platform: "exponent",
                expoHostType: "lan",
            },
            {
                name: "Debug in Exponent (Local)",
                cwd: "${workspaceFolder}",
                type: "reactnative",
                request: "launch",
                platform: "exponent",
                expoHostType: "local",
            },
        ],
    };

    suiteSetup(() => {
        fs.mkdirSync(tmpPath);
        fs.mkdirSync(path.resolve(tmpPath, ".vscode"));
    });

    suiteTeardown(() => {
        fs.unlinkSync(launchPath);
        fs.rmdirSync(path.resolve(tmpPath, ".vscode"));
        fs.rmdirSync(tmpPath);
    });

    setup(() => {
        fs.writeFileSync(launchPath, JSON.stringify(launchContent, null, 4));
    });

    suite("updateLaunchScenario", function () {
        function autogenerateUpdateAndCheck(configIndex: number, updates: any) {
            const config = Object.assign({}, launchContent.configurations[configIndex]);
            Object.assign(config, {
                otherParam: "value1",
                otherObject: {
                    innerParam: "value2",
                },
            });
            const result = Object.assign({}, launchContent);
            Object.assign(result.configurations[configIndex], updates);

            tryUpdateAndCheck(config, updates, result);
        }

        function tryUpdateAndCheck(config: any, updates: any, result: any) {
            const manager = new LaunchScenariosManager(tmpPath);
            manager.updateLaunchScenario(config, updates);
            const launchObject = JSON.parse(fs.readFileSync(launchPath).toString());
            assert.deepStrictEqual(launchObject, result);
        }

        test("should overwrite existing parameters for proper configuration", function () {
            autogenerateUpdateAndCheck(2, { env: { env1: "newValue" } });
        });

        test("should add new parameters to proper configuration", function () {
            autogenerateUpdateAndCheck(5, { env: { env1: "newValue1", env2: "newValue2" } });
        });

        test("should nothing happens if launch.json do not contains config", function () {
            const config = {
                name: "Debug Android",
                type: "reactnative",
                request: "launch",
                platform: "android",
            };

            let configCopy = Object.assign({}, config);
            tryUpdateAndCheck(
                Object.assign(configCopy, { name: "Other name" }),
                { param: "value1" },
                launchContent,
            );
            configCopy = Object.assign({}, config);
            tryUpdateAndCheck(
                Object.assign(configCopy, { type: "Other type" }),
                { param: "value2" },
                launchContent,
            );
            configCopy = Object.assign({}, config);
            tryUpdateAndCheck(
                Object.assign(configCopy, { request: "Other request" }),
                { param: "value3" },
                launchContent,
            );
            configCopy = Object.assign({}, config);
            tryUpdateAndCheck(
                Object.assign(configCopy, { platform: "Other platform" }),
                { param: "value4" },
                launchContent,
            );
        });
    });
});
