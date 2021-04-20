// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.

import { CommandExecutor } from "../../src/common/commandExecutor";
import { ConsoleLogger } from "../../src/extension/log/ConsoleLogger";
import { Node } from "../../src/common/node/node";
import { ChildProcess } from "../../src/common/node/childProcess";
import { EventEmitter } from "events";
import { Crypto } from "../../src/common/node/crypto";
import { AppLauncher } from "../../src/extension/appLauncher";
import * as assert from "assert";
import * as semver from "semver";
import * as sinon from "sinon";
import * as path from "path";
import * as fs from "fs";

suite("commandExecutor", function () {
    suite("extensionContext", function () {
        let childProcessStubInstance = new ChildProcess();
        let childProcessStub: Sinon.SinonStub & ChildProcess;
        let Log = new ConsoleLogger();
        const sampleReactNative022ProjectDir = path.join(
            __dirname,
            "..",
            "resources",
            "sampleReactNative022Project",
        );

        let nodeModulesRoot: string;

        teardown(function () {
            let mockedMethods = [Log.log, ...Object.keys(childProcessStubInstance)];

            mockedMethods.forEach(method => {
                if (method.hasOwnProperty("restore")) {
                    (<any>method).restore();
                }
            });

            childProcessStub.restore();
        });

        setup(() => {
            childProcessStub = sinon
                .stub(Node, "ChildProcess")
                .returns(childProcessStubInstance) as ChildProcess & Sinon.SinonStub;

            nodeModulesRoot = AppLauncher.getNodeModulesRoot(sampleReactNative022ProjectDir);
        });

        test("should execute a command", function () {
            let ce = new CommandExecutor(nodeModulesRoot, process.cwd(), Log);
            let loggedOutput: string = "";

            sinon.stub(Log, "log", function (message: string, formatMessage: boolean = true) {
                loggedOutput += semver.clean(message) || "";
                console.log(message);
            });

            return ce.execute("node -v").then(() => {
                assert(loggedOutput);
            });
        });

        test("should reject on bad command", () => {
            let ce = new CommandExecutor(nodeModulesRoot);

            return ce
                .execute("bar")
                .then(() => {
                    assert.fail(null, null, "bar should not be a valid command");
                })
                .catch(reason => {
                    console.log(reason.message);
                    assert.strictEqual(reason.errorCode, 101);
                    assert.strictEqual(reason.errorLevel, 0);
                });
        });

        test("should reject on good command that fails", () => {
            let ce = new CommandExecutor(nodeModulesRoot);

            return ce
                .execute("node install bad-package")
                .then(() => {
                    assert.fail(null, null, "node should not be able to install bad-package");
                })
                .catch(reason => {
                    console.log(reason.message);
                    assert.strictEqual(reason.errorCode, 101);
                    assert.strictEqual(reason.errorLevel, 0);
                });
        });

        test("should spawn a command", () => {
            let ce = new CommandExecutor(nodeModulesRoot);

            sinon.stub(Log, "log", function (message: string, formatMessage: boolean = true) {
                console.log(message);
            });

            return Promise.resolve().then(function () {
                return ce.spawn("node", ["-v"]);
            });
        });

        test("spawn should reject a bad command", () => {
            let ce = new CommandExecutor(nodeModulesRoot);
            sinon.stub(Log, "log", function (message: string, formatMessage: boolean = true) {
                console.log(message);
            });

            Promise.resolve()
                .then(function () {
                    return ce.spawn("bar", ["-v"]);
                })
                .catch(reason => {
                    console.log(reason.message);
                    assert.strictEqual(reason.errorCode, 101);
                    assert.strictEqual(reason.errorLevel, 0);
                });
        });

        test("should not fail on react-native command without arguments", () => {
            (sinon.stub(childProcessStubInstance, "spawn") as Sinon.SinonStub).returns({
                stdout: new EventEmitter(),
                stderr: new EventEmitter(),
                outcome: Promise.resolve(),
            });

            return new CommandExecutor(nodeModulesRoot)
                .spawnReactCommand("run-ios")
                .outcome.then(null, err => {
                    assert.fail("react-native command was not expected to fail");
                });
        });

        suite("getReactNativeVersion", () => {
            const reactNativePackageDir = path.join(
                sampleReactNative022ProjectDir,
                "node_modules",
                "react-native",
            );
            const fsHelper = new Node.FileSystem();

            suiteSetup(() => {
                fsHelper.makeDirectoryRecursiveSync(reactNativePackageDir);
            });

            suiteTeardown(() => {
                fsHelper.removePathRecursivelySync(
                    path.join(sampleReactNative022ProjectDir, "node_modules"),
                );
            });

            test("getReactNativeVersion should return version string if 'version' field is found in react-native package package.json file from node_modules", () => {
                const commandExecutor: CommandExecutor = new CommandExecutor(
                    nodeModulesRoot,
                    sampleReactNative022ProjectDir,
                );
                const versionObj = {
                    version: "^0.22.0",
                };

                fs.writeFileSync(
                    path.join(reactNativePackageDir, "package.json"),
                    JSON.stringify(versionObj, null, 2),
                );

                return commandExecutor.getReactNativeVersion().then(version => {
                    assert.strictEqual(version, "0.22.0");
                });
            });

            test("getReactNativeVersion should return version string if there isn't 'version' field in react-native package's package.json file", () => {
                const commandExecutor: CommandExecutor = new CommandExecutor(
                    nodeModulesRoot,
                    sampleReactNative022ProjectDir,
                );
                const testObj = {
                    test: "test",
                };

                fs.writeFileSync(
                    path.join(reactNativePackageDir, "package.json"),
                    JSON.stringify(testObj, null, 2),
                );

                return commandExecutor.getReactNativeVersion().then(version => {
                    assert.strictEqual(version, "0.22.2");
                });
            });
        });

        suite("ReactNativeClIApproaches", function () {
            const RNGlobalCLINameContent: any = {
                ["react-native-tools.reactNativeGlobalCommandName"]: "",
            };

            test("selectReactNativeCLI should return local CLI", (done: Mocha.Done) => {
                const localCLIPath = path.join(
                    sampleReactNative022ProjectDir,
                    "node_modules",
                    ".bin",
                    "react-native",
                );
                let commandExecutor: CommandExecutor = new CommandExecutor(
                    nodeModulesRoot,
                    sampleReactNative022ProjectDir,
                );
                CommandExecutor.ReactNativeCommand =
                    RNGlobalCLINameContent["react-native-tools.reactNativeGlobalCommandName"];
                assert.strictEqual(commandExecutor.selectReactNativeCLI(), localCLIPath);
                done();
            });

            test("selectReactNativeCLI should return global CLI", (done: Mocha.Done) => {
                const randomHash = new Crypto().hash(Math.random().toString(36).substring(2, 15));
                RNGlobalCLINameContent[
                    "react-native-tools.reactNativeGlobalCommandName"
                ] = randomHash;
                let commandExecutor: CommandExecutor = new CommandExecutor(
                    nodeModulesRoot,
                    sampleReactNative022ProjectDir,
                );
                CommandExecutor.ReactNativeCommand =
                    RNGlobalCLINameContent["react-native-tools.reactNativeGlobalCommandName"];
                assert.strictEqual(commandExecutor.selectReactNativeCLI(), randomHash);
                done();
            });
        });
    });
});
