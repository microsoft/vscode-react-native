// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.

import {SourceMapUtil} from "../../debugger/sourceMap";

import * as assert from "assert";
import * as path from "path";
import * as url from "url";

suite("sourceMap", function() {
    suite("debuggerContext", function() {
        test("should convert host filesystem paths to URL-style-paths", function() {
            const sourceMap = new SourceMapUtil();
            const filePath = path.join("foo", "bar", "baz");
            const urlPath = "foo/bar/baz";
            const result = (<any>sourceMap).makeUnixStylePath(filePath);
            assert(result === urlPath, `Expected "${urlPath}", found "${result}"`);
        });

        test("should resolve a valid sourcemap url", function () {
            const scriptUrl: url.Url = url.parse("http://localhost:8081/index.ios.bundle?platform=ios&dev=true");
            const scriptBody = "//# sourceMappingURL=/index.ios.map?platform=ios&dev=true";
            const expectedUrlHref = "http://localhost:8081/index.ios.map?platform=ios&dev=true";

            const sourceMap = new SourceMapUtil();
            const result = sourceMap.getSourceMapURL(scriptUrl, scriptBody);
            assert.equal(expectedUrlHref, result.href);
        });

        test("should return null for an invalid sourcemap url", function () {
            const scriptUrl: url.Url = url.parse("http://localhost:8081/index.ios.bundle?platform=ios&dev=true");
            const scriptBody = "";

            const sourceMap = new SourceMapUtil();
            const result = sourceMap.getSourceMapURL(scriptUrl, scriptBody);
            assert(result === null);
        });

        test("updateSourceMapFile", function() {
            const sourceMapBody: string = "";
            const scriptPath: string = "";
            const sourcesRootPath: string = "";
            const sourceMap = new SourceMapUtil();

            const result: string = sourceMap.updateSourceMapFile(sourceMapBody, scriptPath, sourcesRootPath);
        });

        /*test("", function() {

        });*/
    });
});
