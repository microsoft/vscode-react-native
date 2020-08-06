import * as fs from "fs";
import * as path from "path";
import { LaunchScenariosManager } from "../../src/extension/launchScenariosManager";
import * as assert from "assert";

suite("LaunchScenarioManager", function() {
    const tmpPath = path.resolve(__dirname, "..", "resources", "tmp");
    const launchPath = path.resolve(tmpPath, ".vscode", "launch.json");
    const launchContent = {
        version: "0.2.0",
        configurations: [
            {
                name: "Debug Android",
                cwd: "${workspaceFolder}",
                type: "reactnative-preview",
                request: "launch",
                platform: "android",
                target: "simulator"
            },
            {
                name: "Debug Android (Hermes) - Experimental",
                cwd: "${workspaceFolder}",
                type: "reactnativedirect-preview",
                request: "launch",
                platform: "android",
                env: {
                    env1: "value1",
                    env2: "value2"
                }
            },
            {
                name: "Attach to Hermes application - Experimental",
                cwd: "${workspaceFolder}",
                type: "reactnativedirect-preview",
                request: "attach"
            },
            {
                name: "Debug iOS",
                cwd: "${workspaceFolder}",
                type: "reactnative-preview",
                request: "launch",
                platform: "ios"
            },
            {
                name: "Attach to packager",
                cwd: "${workspaceFolder}",
                type: "reactnative-preview",
                request: "attach"
            },
            {
                name: "Debug in Exponent",
                cwd: "${workspaceFolder}",
                type: "reactnative-preview",
                request: "launch",
                platform: "exponent"
            },
            {
                name: "Debug in Exponent (LAN)",
                cwd: "${workspaceFolder}",
                type: "reactnative-preview",
                request: "launch",
                platform: "exponent",
                expoHostType: "lan"
            },
            {
                name: "Debug in Exponent (Local)",
                cwd: "${workspaceFolder}",
                type: "reactnative-preview",
                request: "launch",
                platform: "exponent",
                expoHostType: "local"
            }
        ]
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

    suite("updateLaunchScenario", function() {

        function autogenerateUpdateAndCheck(configIndex: number, updates: any) {
            const config = Object.assign(Object.assign({}, launchContent.configurations[configIndex]), {
                otherParam: "value1",
                otherObject: {
                    innerParam: "value2"
                }
            });
            const result = Object.assign({}, launchContent);
            Object.assign(result.configurations[configIndex], updates);

            tryUpdateAndCheck(config, updates, result);
        }

        function tryUpdateAndCheck(config: any, updates: any, result: any) {
            const manager = new LaunchScenariosManager(tmpPath);
            manager.updateLaunchScenario(config, updates);
            const launchObject = JSON.parse(fs.readFileSync(launchPath).toString());
            console.log(launchObject);
            console.log(result);
            assert.deepStrictEqual(launchObject, result);
        }

        test("should overwrite existing parameters for proper configuration", function() {
            autogenerateUpdateAndCheck(2, {env:{env1: "newValue"}});
        });

        test("should add new parameters to proper configuration", function() {
            autogenerateUpdateAndCheck(5, {env:{env1: "newValue1", env2: "newValue2"}});
        });

        test("should nothing happens if launch.json do not contains config", function() {
            const config = {
                name: "Debug Android",
                type: "reactnative-preview",
                request: "launch",
                platform: "android",
            };

            tryUpdateAndCheck(Object.assign(Object.assign({}, config), {name: "Other name"}), {param: "value1"}, launchContent);
            tryUpdateAndCheck(Object.assign(Object.assign(Object.assign({}, config)), {type: "Other type"}), {param: "value2"}, launchContent);
            tryUpdateAndCheck(Object.assign(Object.assign(Object.assign({}, config)), {request: "Other request"}), {param: "value3"}, launchContent);
            tryUpdateAndCheck(Object.assign(Object.assign(Object.assign({}, config)), {platform: "Other platform"}), {param: "value4"}, launchContent);
        });
    });
});
