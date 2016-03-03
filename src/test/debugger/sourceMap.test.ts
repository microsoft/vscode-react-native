// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.

import {SourceMapUtil} from "../../debugger/sourceMap";

import * as assert from "assert";
import * as path from "path";

suite("sourceMap", function() {
    suite("debuggerContext", function() {
        test("should convert host filesystem paths to URL-style-paths", function() {
            const sourceMap = new SourceMapUtil();
            const filePath = path.join("foo", "bar", "baz");
            const urlPath = "foo/bar/baz";
            const result = (<any>sourceMap).makeUnixStylePath(filePath);
            assert(result === urlPath, `Expected "${urlPath}", found "${result}`);
        });

        // TODO: This class definitely needs more tests
    });
});