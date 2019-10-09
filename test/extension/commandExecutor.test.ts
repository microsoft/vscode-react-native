// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.

import { CommandExecutor } from "../../src/common/commandExecutor";
import { ConsoleLogger } from "../../src/extension/log/ConsoleLogger";

import { Node } from "../../src/common/node/node";
import { FileSystem } from "../../src/common/node/fileSystem";
import { ChildProcess } from "../../src/common/node/childProcess";

import { EventEmitter } from "events";
import * as assert from "assert";
import * as semver from "semver";
import * as sinon from "sinon";
import * as Q from "q";
import * as path from "path";
import * as fs from "fs";

suite("commandExecutor", function() {
    suite("extensionContext", function () {

        let childProcessStubInstance = new ChildProcess();
        let childProcessStub: Sinon.SinonStub & ChildProcess;
        let Log = new ConsoleLogger();
        const sampleReactNative022ProjectDir = path.join(__dirname, "..", "resources", "sampleReactNative022Project");

        teardown(function() {
            let mockedMethods = [Log.log, ...Object.keys(childProcessStubInstance)];

            mockedMethods.forEach((method) => {
                if (method.hasOwnProperty("restore")) {
                    (<any>method).restore();
                }
            });

            childProcessStub.restore();
        });

        setup(() => {
            childProcessStub = sinon.stub(Node, "ChildProcess")
                .returns(childProcessStubInstance) as ChildProcess & Sinon.SinonStub;
        });

        test("should execute a command", function() {
            let ce = new CommandExecutor(process.cwd(), Log);
            let loggedOutput: string = "";

            sinon.stub(Log, "log", function(message: string, formatMessage: boolean = true) {
                loggedOutput += semver.clean(message) || "";
                console.log(message);
            });

            return ce.execute("node -v")
                .then(() => {
                    assert(loggedOutput);
                });
        });

        test("should reject on bad command", function() {
            let ce = new CommandExecutor();

            return ce.execute("bar")
                .then(() => {
                    assert.fail(null, null, "bar should not be a valid command");
                })
                .catch((reason) => {
                    console.log(reason.message);
                    assert.equal(reason.errorCode, 101);
                    assert.equal(reason.errorLevel, 0);
                });
        });

        test("should reject on good command that fails", function() {
            let ce = new CommandExecutor();

            return ce.execute("node install bad-package")
                .then(() => {
                    assert.fail(null, null, "node should not be able to install bad-package");
                })
                .catch((reason) => {
                    console.log(reason.message);
                    assert.equal(reason.errorCode, 101);
                    assert.equal(reason.errorLevel, 0);
                });
        });

        test("should spawn a command", function(done: MochaDone) {
            let ce = new CommandExecutor();

            sinon.stub(Log, "log", function(message: string, formatMessage: boolean = true) {
                console.log(message);
            });

            Q({})
                .then(function () {
                    return ce.spawn("node", ["-v"]);
                }).done(() => done(), done);
        });

        test("spawn should reject a bad command", function(done: MochaDone) {
            let ce = new CommandExecutor();
            sinon.stub(Log, "log", function(message: string, formatMessage: boolean = true) {
                console.log(message);
            });

            Q({})
                .then(function() {
                    return ce.spawn("bar", ["-v"]);
                })
                .catch((reason) => {
                    console.log(reason.message);
                    assert.equal(reason.errorCode, 101);
                    assert.equal(reason.errorLevel, 0);
                }).done(() => done(), done);
        });

        test("should not fail on react-native command without arguments", function (done: MochaDone) {
            (sinon.stub(childProcessStubInstance, "spawn") as Sinon.SinonStub)
                .returns({
                    stdout: new EventEmitter(),
                    stderr: new EventEmitter(),
                    outcome: Promise.resolve(void 0),
                });

            new CommandExecutor()
                .spawnReactCommand("run-ios").outcome
                .then(done, err => {
                    assert.fail(null, null, "react-native command was not expected to fail");
                });
        });

        test("getReactNativeVersion should return version string if there is 'react-native' field in project package.json", (done: MochaDone) => {
            let commandExecutor: CommandExecutor = new CommandExecutor(sampleReactNative022ProjectDir);

            commandExecutor.getReactNativeVersion()
            .then(version => {
                assert.equal(version, "^0.22.2");
            }).done(() => done(), done);
        });

        test("getReactNativeVersion should return version string if there is 'version' field in react-native package's package.json file", (done: MochaDone) => {
            const reactNativePackageDir = path.join(sampleReactNative022ProjectDir, "node_modules", "react-native");
            const commandExecutor: CommandExecutor = new CommandExecutor(sampleReactNative022ProjectDir);
            let fsHelper: FileSystem = new Node.FileSystem();
            let versionObj = {
                "version": "^0.22.0",
            };

            if (!fs.existsSync(reactNativePackageDir)) {
                fsHelper.makeDirectoryRecursiveSync(reactNativePackageDir);
            }

            fs.writeFileSync(path.join(reactNativePackageDir, "package.json"), JSON.stringify(versionObj, null, 2));

            commandExecutor.getReactNativeVersion()
            .then(version => {
                assert.equal(version, "^0.22.0");
                fsHelper.removePathRecursivelySync(path.join(sampleReactNative022ProjectDir, "node_modules"));
            }).done(() => done(), done);
        });

        test("getReactNativeVersion should return version string if there isn't 'version' field in react-native package's package.json file", (done: MochaDone) => {
            const reactNativePackageDir = path.join(sampleReactNative022ProjectDir, "node_modules", "react-native");
            const commandExecutor: CommandExecutor = new CommandExecutor(sampleReactNative022ProjectDir);
            let fsHelper: FileSystem = new Node.FileSystem();
            let testObj = {
                "test": "test",
            };

            if (!fs.existsSync(reactNativePackageDir)) {
                fsHelper.makeDirectoryRecursiveSync(reactNativePackageDir);
            }

            fs.writeFileSync(path.join(reactNativePackageDir, "package.json"), JSON.stringify(testObj, null, 2));

            commandExecutor.getReactNativeVersion()
            .then(version => {
                assert.equal(version, "^0.22.2");
                fsHelper.removePathRecursivelySync(path.join(sampleReactNative022ProjectDir, "node_modules"));
            }).done(() => done(), done);
        });

        suite("ReactNativeClIApproaches", function () {
            const RNGlobalCLINameContent: any = {
                ["react-native-tools.reactNativeGlobalCommandName"]: "",
            };

            test("selectReactNativeCLI should return local CLI", (done: MochaDone) => {
                const localCLIPath = path.join(sampleReactNative022ProjectDir, "node_modules", ".bin", "react-native");
                let commandExecutor: CommandExecutor = new CommandExecutor(sampleReactNative022ProjectDir);
                CommandExecutor.ReactNativeCommand = RNGlobalCLINameContent["react-native-tools.reactNativeGlobalCommandName"];
                assert.equal(commandExecutor.selectReactNativeCLI(), localCLIPath);
                done();
            });

            test("selectReactNativeCLI should return global CLI", (done: MochaDone) => {
                const randomHash = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15); // Generate random hash string, e. g. 'kvwceypjqulgaqmfz77wq'
                RNGlobalCLINameContent["react-native-tools.reactNativeGlobalCommandName"] = randomHash;
                let commandExecutor: CommandExecutor = new CommandExecutor(sampleReactNative022ProjectDir);
                CommandExecutor.ReactNativeCommand = RNGlobalCLINameContent["react-native-tools.reactNativeGlobalCommandName"];
                assert.equal(commandExecutor.selectReactNativeCLI(), randomHash);
                done();
            });
        });
    });
});
