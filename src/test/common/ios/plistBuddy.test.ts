// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.

import {PlistBuddy} from "../../../common/ios/plistBuddy";

import * as Q from "q";

suite("plistBuddy", function() {
    suite("commonContext", function() {
        test("Should attempt to set plist properties correctly", function() {
            const plistFileName = "testFile.plist";
            const plistProperty = "myProperty";
            const plistValue = "myValue";

            const deferred1 = Q.defer<void>();
            const deferred2 = Q.defer<void>();

            const mockExec: any = {
                exec: (command: string, opts: any) => {
                    if (command.match(/Set/)) {
                        deferred1.resolve(void 0);
                        return { outcome: Q.reject(new Error("Setting does not exist")) };
                    } else if (command.match("Add")) {
                        deferred1.reject(new Error("Adding before setting"));
                        deferred2.resolve(void 0);
                        return { outcome: Q.resolve("stdout") };
                    } else {
                        const err = new Error(`Unexpected Command: ${command}`);
                        deferred1.reject(err);
                        deferred2.reject(err);
                        return { outcome: Q.reject(err) };
                    }
                }
            };
            const plistBuddy = new PlistBuddy(mockExec);

            return Q.all([
                plistBuddy.setPlistProperty(plistFileName, plistProperty, plistValue),
                deferred1.promise,
                deferred2.promise
            ]);
    });
});
});