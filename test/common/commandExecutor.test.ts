// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.

import {CommandExecutor} from "../../src/common/commandExecutor";
import { Log } from "../../src/common/log/log";

import { Node } from "../../src/common/node/node";
import { ChildProcess } from "../../src/common/node/childProcess";


import { EventEmitter } from "events";
import * as assert from "assert";
import * as semver from "semver";
import * as sinon from "sinon";
import * as Q from "q";

suite("commandExecutor", function() {
    suite("commonContext", function () {

        let childProcessStubInstance = new ChildProcess();
        let childProcessStub: Sinon.SinonStub & ChildProcess;

        teardown(function() {
            let mockedMethods = [Log.logMessage, ...Object.keys(childProcessStubInstance)];

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
            let ce = new CommandExecutor();
            let loggedOutput: string = "";

            sinon.stub(Log, "logMessage", function(message: string, formatMessage: boolean = true) {
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
            let loggedOutput: string = "";

            sinon.stub(Log, "logMessage", function(message: string, formatMessage: boolean = true) {
                loggedOutput += message;
                console.log(message);
            });

            Q({})
                .then(function () {
                    return ce.spawn("node", ["-v"]);
                }).done(() => done(), done);
        });

        test("spawn should reject a bad command", function(done: MochaDone) {
            let ce = new CommandExecutor();
            let loggedOutput: string = "";

            sinon.stub(Log, "logMessage", function(message: string, formatMessage: boolean = true) {
                loggedOutput += message;
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
                    assert.fail(null, null, "react-natibe command was not expected to fail");
                });
        });
    });
});
