// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.

import {CommandExecutor} from "../../common/commandExecutor";
import {Log} from "../../common/log/log";

import * as assert from "assert";
import * as semver from "semver";
import * as sinon from "sinon";

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
            let actualExecuteResult: string[] = [];

            sinon.stub(Log, "logMessage", function(message: string) {
                actualExecuteResult.push(message.replace("\n", ""));
                console.log(message);
            });

            return ce.execute("node -v")
                .then(() => {
                    let nodeVersion = actualExecuteResult[0];
                    assert(semver.valid(nodeVersion));
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
    });
});