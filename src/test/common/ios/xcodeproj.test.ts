// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.

import {Xcodeproj} from "../../../common/ios/xcodeproj";

import * as assert from "assert";
import * as path from "path";
import * as Q from "q";

suite("xcodeproj", function() {
    suite("commonContext", function() {
        test("should look in the correct location for xcodeproj files and return one", function() {
            const projectRoot = path.join("/", "tmp", "myProject");
            const testFiles = ["foo.xcodeproj"];
            const mockFileSystem: any = {
                readDir: (path: string) => {
                    return Q(testFiles);
                },
            };

            const xcodeproj = new Xcodeproj({ nodeFileSystem: mockFileSystem });

            return xcodeproj.findXcodeprojFile(projectRoot)
                .then((proj) => {
                    assert.deepEqual(proj, {
                        filename: path.join(projectRoot, testFiles[0]),
                        filetype: ".xcodeproj",
                        projectName: "foo",
                    });
                });
        });
    });
});