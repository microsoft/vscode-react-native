// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.

import {Xcodeproj} from "../../../src/common/ios/xcodeproj";

import * as assert from "assert";
import * as path from "path";
import * as Q from "q";

suite("xcodeproj", function() {
    suite("commonContext", function() {
        test("should look in the correct location for xcodeproj files and return one", function() {
            const projectRoot = path.join("/", "tmp", "myProject");
            const projectName = "foo";
            const fileType = ".xcodeproj";
            const testFiles = [projectName + fileType];
            const mockFileSystem: any = {
                readDir: () => {
                    return Q(testFiles);
                },
            };

            const xcodeproj = new Xcodeproj({ nodeFileSystem: mockFileSystem });

            return xcodeproj.findXcodeprojFile(projectRoot)
                .then((proj) => {
                    assert.deepEqual(proj, {
                        fileName: path.join(projectRoot, testFiles[0]),
                        fileType,
                        projectName,
                    });
                });
        });
        test("should look in the correct location for xcodeproj/xcworkspace files and prefer xcworkspace over xcodeproj", function() {
            const projectRoot = path.join("/", "tmp", "myProject");
            const projectName = "foo";
            const xcodeprojFileType = ".xcodeproj";
            const xcworkspaceFileType = ".xcworkspace";
            const xcodeprojFileName = projectName + xcodeprojFileType;
            const xcworkspaceFileName = projectName + xcworkspaceFileType;
            const testFiles = [xcodeprojFileName, xcworkspaceFileName];
            const mockFileSystem: any = {
                readDir: () => {
                    return Q(testFiles);
                },
            };

            const xcodeproj = new Xcodeproj({ nodeFileSystem: mockFileSystem });

            return xcodeproj.findXcodeprojFile(projectRoot)
                .then((proj) => {
                    assert.deepEqual(proj, {
                        fileName: path.join(projectRoot, xcworkspaceFileName),
                        fileType: xcworkspaceFileType,
                        projectName,
                    });
                });
        });
    });
});
