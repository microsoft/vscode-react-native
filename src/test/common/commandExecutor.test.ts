// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.

import {CommandExecutor} from "../../common/commandExecutor";
import {Log} from "../../common/log/log";
import {ChildProcess} from "child_process";

import * as assert from "assert";
import * as semver from "semver";
import * as sinon from "sinon";
import * as Q from "q";

suite("commandExecutor", function() {
    suite("commonContext", function() {
        teardown(function() {
            let mockedMethods = [Log.logMessage, Log.logCommandStatus];

            mockedMethods.forEach((method) => {
                if (method.hasOwnProperty("restore")) {
                    (<any>method).restore();
                }
            });
        });

        test("should execute a command", function() {
            let ce = new CommandExecutor();
            let loggedOutput: string = "";

            sinon.stub(Log, "logMessage", function(message: string, formatMessage: boolean = true) {
                loggedOutput += message;
                console.log(message);
            });

            return ce.execute("node -v")
                .then(() => {
                    let nodeVersion = semver.clean(loggedOutput);
                    assert(nodeVersion);
                });
        });

        test("should reject on bad command", function() {
            let ce = new CommandExecutor();

            return ce.execute("bar")
                .then(() => {
                    assert.fail("bar should not be a valid command");
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
                    assert.fail("node should not be able to install bad-package");
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
                .then(function() {
                    let process: ChildProcess = ce.spawn("node", ["-v"]);
                    let deferred = Q.defer<string>();

                    process.stdout.on("data", function(data: any) {
                        deferred.resolve(data.toString());
                    });

                    return deferred.promise;
                })
                .then(function(output: string) {
                    assert(semver.clean(output));
                }).done(() => done(), done);
        });

        test("should spawnAndWaitForCompletion a command", function(done: MochaDone) {
            let ce = new CommandExecutor();
            let loggedOutput: string = "";

            sinon.stub(Log, "logMessage", function(message: string, formatMessage: boolean = true) {
                loggedOutput += message;
                console.log(message);
            });

            Q({})
                .then(function () {
                    return ce.spawnAndWaitForCompletion("node", ["-v"]);
                }).done(() => done(), done);
        });

        test("spawnAndWaitForCompletion should reject a bad command", function(done: MochaDone) {
            let ce = new CommandExecutor();
            let loggedOutput: string = "";

            sinon.stub(Log, "logMessage", function(message: string, formatMessage: boolean = true) {
                loggedOutput += message;
                console.log(message);
            });

            Q({})
                .then(function() {
                    return ce.spawnAndWaitForCompletion("bar", ["-v"]);
                })
                .catch((reason) => {
                    console.log(reason.message);
                    assert.equal(reason.errorCode, 101);
                    assert.equal(reason.errorLevel, 0);
                }).done(() => done(), done);
        });
    });
});