// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.

import {PlistBuddy} from "../../../common/ios/plistBuddy";

import * as assert from "assert";
import * as Q from "q";
import * as sinon from "sinon";

suite("plistBuddy", function() {
    suite("commonContext", function() {
        test("setPlistProperty should attempt to modify, then add, plist properties", function() {
            const plistFileName = "testFile.plist";
            const plistProperty = "myProperty";
            const plistValue = "myValue";

            const mockedExecFunc = sinon.stub();
            mockedExecFunc.onFirstCall().returns({ outcome: Q.reject(new Error("Setting does not exist")) });
            mockedExecFunc.onSecondCall().returns({ outcome: Q.resolve("stdout") });
            mockedExecFunc.throws();

            const mockExec: any = {
                exec: mockedExecFunc
            };
            const plistBuddy = new PlistBuddy({ nodeChildProcess: mockExec });

            return plistBuddy.setPlistProperty(plistFileName, plistProperty, plistValue)
                .then(() => {
                    const setRegex = new RegExp(`Set\s+${plistProperty}\s+${plistValue}`);
                    const addRegex = new RegExp(`Add\s+${plistProperty}\s+string\s+${plistValue}`);
                    assert(mockedExecFunc.calledWithMatch(setRegex), "plistBuddy did not attempt to set first");
                    assert(mockedExecFunc.calledWithMatch(addRegex), "plistBuddy did not attempt to add after set failed");
                    assert(mockedExecFunc.callCount === 2, "plistBuddy executed the wrong number of times");
                });
        });
    });
});