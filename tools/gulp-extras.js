// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.
"use strict";

var child_process = require("child_process");
var fs = require("fs");
var gutil = require("gulp-util");
var path = require("path");
var PluginError = gutil.PluginError;
var through = require("through2");

/**
 * Pretty logger using gutil.log
 * @param {string} pluginName Name of the pluginName
 * @param {Object} file A gulp file to report on
 * @param {string} message The error message to display
 */
var logError = function(pluginName, file, message) {
    var sourcePath = path.relative(__dirname, file.path).replace("../","");
    gutil.log("[" + gutil.colors.cyan(pluginName) + "] " + gutil.colors.red("error") + " " + sourcePath + ": " + message);
};

/**
 * Plugin to verify the Microsoft copyright notice is present
 */
var checkCopyright = function() {
    var pluginName = "check-copyright";
    var hadErrors = false;
    var copyrightNotice = "// Copyright (c) Microsoft Corporation. All rights reserved.\n// Licensed under the MIT license. See LICENSE file in the project root for details.";

    return through.obj(function(file, encoding, callback) {
        if (file.isBuffer()) {
            var fileContents = file.contents.toString(encoding);
            fileContents = fileContents.replace("\r\n", "\n");

            if (fileContents.indexOf(copyrightNotice) !== 0) {
                logError(pluginName, file, "missing copyright notice");
                hadErrors = true;
            }
        }

        callback(null, file);
    },
    function(callback) {
        if (hadErrors) {
            return this.emit("error", new PluginError(pluginName, "Failed copyright check"));
        }
        callback();
    });
};

/**
 * Helper function to check if a file exists case sensitive
 * @param {string} filePath The path to check
 * @returns {boolean} If the path exists case sensitive
 */
var existsCaseSensitive = function(filePath) {
    if (fs.existsSync(filePath)) {
        var fileName = path.basename(filePath);
        return fs.readdirSync(path.dirname(filePath)).indexOf(fileName) !== -1;
    }

    return false;
};

/**
 * Plugin to verify if import statements use correct casing
 */
var checkImports = function() {
    var pluginName = "check-imports";
    var hadErrors = false;
    var re = /(?:\s|^)(?:[^\n:]*).*from ["'](\.[^"']*)["'];/;

    return through.obj(function(file, encoding, callback) {
        if (file.isBuffer()) {
            var fileContents = file.contents.toString(encoding);
            var importStatements = fileContents.match(new RegExp(re.source, "g")) || [];
            var workingDirectory = path.dirname(file.path);

            importStatements.forEach(function(importStatement) {
                var modulePath = re.exec(importStatement);
                if (modulePath && modulePath[1]) {
                    var moduleFilePath = path.resolve(workingDirectory, modulePath[1] + ".ts");

                    if (!existsCaseSensitive(moduleFilePath)) {
                        logError(pluginName, file, "unresolved import: \"" + modulePath[1] + "\"");
                        hadErrors = true;
                    }
                }
            });
        }

        callback(null, file);
    },
    function(callback) {
        if (hadErrors) {
            return this.emit("error", new PluginError(pluginName, "Failed import casing check"));
        }
        callback();
    });
};

var executeCommand = function(command, args, callback) {
    var process = child_process.spawn(command, args);
    var errorSignaled = false;

    process.stdout.on("data", function(data) {
        console.log("" + data);
    });

    process.stderr.on("data", function(data) {
        console.error("" + data);
    });

    process.on("error", function(error) {
        if (!errorSignaled) {
            callback("An error occurred. " + error);
            errorSignaled = true;
        }
    });

    process.on("exit", function(code) {
        if (code === 0) {
            callback();
        } else if (!errorSignaled) {
            callback("Error code: " + code);
            errorSignaled = true;
        }
    });
};

module.exports = {
    checkCopyright: checkCopyright,
    checkImports: checkImports,
    executeCommand: executeCommand
}