// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.

import {Xcodeproj} from "../../../common/ios/xcodeproj";

import * as path from "path";
import * as Q from "q";

suite("xcodeproj", function() {
    suite("commonContext", function() {
        test("should look in the correct location for xcodeproj files and return one", function() {
            const projectRoot = "projectRoot";
            const extension = "xcodeproj";
            const testFiles = ["foo.xcodeproj"];
            const mockFileSystem: any = {
                findFilesByExtension: (path: string, ext: string) => {
                    if (extension !== ext) {
                        throw new Error(`Expected ${xcodeproj} got ${ext}`);
                    }
                    return Q(testFiles);
                }
            }
            const xcodeproj = new Xcodeproj({ nodeFileSystem: mockFileSystem });

            return xcodeproj.findXcodeprojFile(projectRoot)
                .then((file) => {
                    if (path.extname(file) !== '.' + extension) {
                        throw new Error(`Expected *.${extension}, got ${file}`)
                    }
                })
        });
    });
});