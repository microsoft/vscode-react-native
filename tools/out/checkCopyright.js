// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.
"use strict";
var FindFiles = require("node-find-files");
var fs = require("fs");
var Q = require("q");
var path_module = require("path");
var CopyrightVerifier = (function () {
    function CopyrightVerifier() {
        this.foundMissing = false;
    }
    CopyrightVerifier.prototype.findIn = function (path) {
        var defer = Q.defer();
        var foundFiles = [];
        var finder = new FindFiles({
            rootFolder: path,
            filterFunction: function (path, stat) {
                // match only filename
                return path.match(CopyrightVerifier.SOURCE_CODE_FILE_PATTERN) && !path.match(CopyrightVerifier.EXCLUDED_FILE_PATTERN);
            }
        });
        finder.on("match", function (filePath, fileStats) {
            var contents = fs.readFileSync(filePath).toString().replace(/\r\n/g, "\n");
            if (contents.startsWith(CopyrightVerifier.UTB_BYTE_ORDER_MARKER)) {
                contents = contents.substr(1);
            }
            if (!contents.startsWith(CopyrightVerifier.COPYRIGHT_NOTICE)) {
                foundFiles.push(filePath);
            }
        });
        finder.on("complete", function () {
            return defer.resolve(foundFiles);
        });
        finder.on("patherror", function (err, strPath) {
            // defer.reject("Error for Path " + strPath + " " + err);
        });
        finder.on("error", function (err) {
            defer.reject("Global Error " + err);
        });
        finder.startSearch();
        return defer.promise;
    };
    CopyrightVerifier.prototype.findInAll = function (paths) {
        var _this = this;
        return Q.all(paths.map(function (path) { return _this.findIn(path_module.resolve(path)); })).then(function (invalids) {
            return [].concat.apply([], invalids);
        });
    };
    CopyrightVerifier.prototype.verify = function () {
        var paths = [];
        for (var _i = 0; _i < arguments.length; _i++) {
            paths[_i - 0] = arguments[_i];
        }
        return this.findInAll(paths).done(function (filePaths) {
            if (filePaths.length !== 0) {
                process.stderr.write("Found files which don't match the expected copyright notice:\n");
                filePaths.forEach(function (filePath) { return process.stderr.write("\t" + filePath + "\n"); });
                process.exit(1);
            }
            else {
                process.exit(0);
            }
        }, function (reason) {
            process.stderr.write("Uknown error while trying to check files copyright: " + reason);
            process.exit(1);
        });
    };
    CopyrightVerifier.UTB_BYTE_ORDER_MARKER = "\ufeff";
    CopyrightVerifier.SOURCE_CODE_FILE_PATTERN = /.*\.(ts|js)$/;
    CopyrightVerifier.EXCLUDED_FILE_PATTERN = /.*\.d\.ts/;
    CopyrightVerifier.COPYRIGHT_NOTICE = "// Copyright (c) Microsoft Corporation. All rights reserved.\n" +
        "// Licensed under the MIT license. See LICENSE file in the project root for details.\n";
    return CopyrightVerifier;
}());
new CopyrightVerifier().verify("../src", "../tools");
//# sourceMappingURL=checkCopyright.js.map