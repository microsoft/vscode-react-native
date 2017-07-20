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

        test("should ignore inline sourcemap urls", function () {
            const scriptUrl: url.Url = url.parse("http://localhost:8081/index.ios.bundle?platform=ios&dev=true");
            const scriptBody = "//# sourceMappingURL=data:application/json;base64,eyJmb28iOiJiYXIifQ==\n" +
                               "//# sourceMappingURL=/index.ios.map?platform=ios&dev=true";
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

        test("should return null if there are only inline sourcemap urls", function () {
            const scriptUrl: url.Url = url.parse("http://localhost:8081/index.ios.bundle?platform=ios&dev=true");
            const scriptBody = "//# sourceMappingURL=data:application/json;base64,eyJmb28iOiJiYXIifQ==\n" +
                               "//# sourceMappingURL=data:application/json;base64,eyJiYXoiOiJxdXV4In0=";

            const sourceMap = new SourceMapUtil();
            const result = sourceMap.getSourceMapURL(scriptUrl, scriptBody);
            assert(result === null);
        });

        test("should update the contents of a source map file", function() {
            const sourceMapBody: string = JSON.stringify({"version": 3, "sources": ["test/index.ts"], "names": [], "mappings": "", "file": "test/index.js", "sourceRoot": "/Project/fuzz"});
            const scriptPath: string = "test/newIndex.ts";
            const expectedSourceMapBody: string = JSON.stringify({"version": 3, "sources": ["/Project/fuzz/test/index.ts"], "names": [], "mappings": "", "file": scriptPath, "sourceRoot": ""});
            const sourceMap = new SourceMapUtil();

            const result: string = sourceMap.updateSourceMapFile(sourceMapBody, scriptPath);
            assert.equal(expectedSourceMapBody, result);
        });

        test("should update scripts with source mapping urls", function() {
            const scriptBody: string = "//# sourceMappingURL=/index.ios.map?platform=ios&dev=true";
            const sourceMappingUrl: url.Url = url.parse("/index.android.map");
            const expectedScriptBody = "//# sourceMappingURL=index.android.map";
            const sourceMap = new SourceMapUtil();

            const result = sourceMap.updateScriptPaths(scriptBody, sourceMappingUrl);
            assert.equal(expectedScriptBody, result);
        });

        test("should not update scripts without source mapping urls", function() {
            const scriptBody: string = "var path = require('path');";
            const sourceMappingUrl: url.Url = url.parse("/index.android.map");
            const sourceMap = new SourceMapUtil();

            const result = sourceMap.updateScriptPaths(scriptBody, sourceMappingUrl);
            assert.equal(scriptBody, result);
        });

        test("should update absolute source path to unix style path", function() {
            const sourcesRootPath: string = "/Project/fuzz";
            const sourcePath: string = "foo/bar";
            const expectedPath: string = "/Project/fuzz/foo/bar";
            // const expectedPath: string = `${process.cwd().replace(/\\/g, "/")}/baz/fuzz/foo/bar`;
            const sourceMap = new SourceMapUtil();

            const result = (<any>sourceMap).updateSourceMapPath(sourcesRootPath, sourcePath);
            assert.equal(expectedPath, result);
        });
    });
});
