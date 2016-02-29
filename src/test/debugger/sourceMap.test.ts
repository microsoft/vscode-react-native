// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.

import {SourceMapUtil} from "../../debugger/sourceMap";

import * as assert from "assert";

suite("sourceMap", function() {
    suite("debuggerContext", function() {
        test("should convert windows-style-paths to unix-style-paths", function () {
            const sourceMap = new SourceMapUtil();
            const windowsPath = "foo\\bar\\baz";
            const unixPath = "foo/bar/baz";
            const result = (<any>sourceMap).makeUnixStylePath(windowsPath);
            assert(result === unixPath, `Expected "${unixPath}", found "${result}`);
        });
    });
});