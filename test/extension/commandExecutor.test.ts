// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.

import { CommandExecutor } from "../../src/common/commandExecutor";
import { ConsoleLogger } from "../../src/extension/log/ConsoleLogger";
import { SettingsHelper } from "../../src/extension/settingsHelper";
import { HostPlatform } from "../../src/common/hostPlatform";

import { Node } from "../../src/common/node/node";
import { ChildProcess } from "../../src/common/node/childProcess";

import * as vscode from "vscode";
import * as fs from "fs";
import * as cp from "child_process";
import { EventEmitter } from "events";
import * as assert from "assert";
import * as semver from "semver";
import * as sinon from "sinon";
import * as Q from "q";
import * as path from "path";

suite("commandExecutor", function() {
    suite("extensionContext", function () {

        let childProcessStubInstance = new ChildProcess();
        let childProcessStub: Sinon.SinonStub & ChildProcess;
        let Log = new ConsoleLogger();

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

        test("getReactNativeVersion should return verson string if there is react-native package in node_modules", (done: MochaDone) => {
            let commandExecutor: CommandExecutor = new CommandExecutor(path.join(__dirname, "..", "resources", "sampleReactNative022Project"));

            Q({})
            .then(function() {
                return commandExecutor.getReactNativeVersion();
            })
            .then(function(version) {
                assert.equal(version, "^0.22.2");
            }).done(() => done(), done);
        });

        suite("ReactNativeClIApproaches", function () {

            const sampleReactNative022ProjectDir = path.join(__dirname, "..", "resources", "sampleReactNative022Project");
            let uri: vscode.Uri;
            const correctRNGlobalCLINameContent: any = {
                "react-native-tools.reactNativeGlobalCommandName": "react-native",
            };

            const incorrectRNGlobalCLINameContent: any = {
                "react-native-tools.reactNativeGlobalCommandName": "incorrect",
            };

            setup(() => {
                cp.execSync("npm i", { cwd: sampleReactNative022ProjectDir });
                fs.writeFileSync(path.join(sampleReactNative022ProjectDir, "settings.json"), JSON.stringify(correctRNGlobalCLINameContent));
                uri = vscode.Uri.file(sampleReactNative022ProjectDir);

                console.log("setup ReactNativeClIApproaches");
            });

            test("selectReactNativeCLI should return correct global CLI", (done: MochaDone) => {
                let reactNativeGlobalCommandName = SettingsHelper.getReactNativeGlobalCommandName(uri);
                let commandExecutor: CommandExecutor = new CommandExecutor(sampleReactNative022ProjectDir);
                CommandExecutor.ReactNativeCommand = reactNativeGlobalCommandName;
                assert.equal(commandExecutor.selectReactNativeCLI, "react-native");
                done();
            });

            test("selectReactNativeCLI should return incorrect global CLI", (done: MochaDone) => {
                fs.writeFileSync(path.join(sampleReactNative022ProjectDir, "settings.json"), JSON.stringify(incorrectRNGlobalCLINameContent));
                let reactNativeGlobalCommandName = SettingsHelper.getReactNativeGlobalCommandName(uri);
                let commandExecutor: CommandExecutor = new CommandExecutor(sampleReactNative022ProjectDir);
                CommandExecutor.ReactNativeCommand = reactNativeGlobalCommandName;
                assert.equal(commandExecutor.selectReactNativeCLI, "incorrect");
                done();
            });

            test("selectReactNativeCLI should return local CLI", (done: MochaDone) => {
                const localCLIPath = HostPlatform.getNpmCliCommand(path.join(sampleReactNative022ProjectDir, "node_modules", ".bin", "react-native"));
                fs.unlinkSync(path.join(sampleReactNative022ProjectDir, "settings.json"));
                let reactNativeGlobalCommandName = SettingsHelper.getReactNativeGlobalCommandName(uri);
                let commandExecutor: CommandExecutor = new CommandExecutor(sampleReactNative022ProjectDir);
                CommandExecutor.ReactNativeCommand = reactNativeGlobalCommandName;
                assert.equal(commandExecutor.selectReactNativeCLI, localCLIPath);
                done();
            });
        });
    });
});
