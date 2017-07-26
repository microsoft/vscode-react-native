// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.
"use strict";

const child_process = require("child_process");
const fs = require("fs");
const gutil = require("gulp-util");
const path = require("path");
const PluginError = gutil.PluginError;
const through = require("through2");

/**
 * Pretty logger using gutil.log
 * @param {string} pluginName Name of the pluginName
 * @param {Object} file A gulp file to report on
 * @param {string} message The error message to display
 */
const logError = function (pluginName, file, message) {
    let sourcePath = path.relative(__dirname, file.path).replace("../", "");
    gutil.log("[" + gutil.colors.cyan(pluginName) + "] " + gutil.colors.red("error") + " " + sourcePath + ": " + message);
};

/**
 * Plugin to verify the Microsoft copyright notice is present
 */
function checkCopyright() {
    const pluginName = "check-copyright";
    const copyrightNotice = `// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.`;
    let hadErrors = false;

    return through.obj(function (file, encoding, callback) {
            if (file.isBuffer()) {
                let fileContents = file.contents.toString(encoding);
                fileContents = fileContents.replace("\r\n", "\n");

                if (fileContents.indexOf(copyrightNotice) !== 0) {
                    logError(pluginName, file, "missing copyright notice");
                    hadErrors = true;
                }
            }

            callback(null, file);
        },
        function (callback) {
            if (hadErrors) {
                return this.emit("error", new PluginError(pluginName, "Failed copyright check"));
            }
            callback();
        });
}

/**
 * Helper function to check if a file exists case sensitive
 * @param {string} filePath The path to check
 * @returns {boolean} If the path exists case sensitive
 */
function existsCaseSensitive(filePath) {
    if (fs.existsSync(filePath)) {
        let fileName = path.basename(filePath);
        return fs.readdirSync(path.dirname(filePath)).indexOf(fileName) !== -1;
    }

    return false;
}

/**
 * Plugin to verify if import statements use correct casing
 */
function checkImports() {
    const pluginName = "check-imports";
    const re = /^import[^\n:]+from\s['"](\.[^'"]+)['"];?/mg;
    let hadErrors = false;

    return through.obj(function (file, encoding, callback) {
            if (file.isBuffer()) {
                let fileContents = file.contents.toString(encoding);
                let workingDirectory = path.dirname(file.path);
                let importStatement = re.exec(fileContents);

                while (importStatement) {
                    let modulePath = importStatement[1];
                    let moduleFilePath = path.resolve(workingDirectory, modulePath + ".ts");

                    if (!existsCaseSensitive(moduleFilePath)) {
                        logError(pluginName, file, `unresolved import: "${modulePath}"`);
                        hadErrors = true;
                    }
                    importStatement = re.exec(fileContents);
                }
            }

            callback(null, file);
        },
        function (callback) {
            if (hadErrors) {
                return this.emit("error", new PluginError(pluginName, "Failed import casing check"));
            }
            callback();
        });
}

function executeCommand(command, args, callback, opts) {
    let proc = child_process.spawn(command + (process.platform === "win32" ? ".cmd" : ""), args, opts);
    let errorSignaled = false;

    proc.stdout.on("data", function (data) {
        console.log("" + data);
    });

    proc.stderr.on("data", function (data) {
        console.error("" + data);
    });

    proc.on("error", function (error) {
        if (!errorSignaled) {
            callback("An error occurred. " + error);
            errorSignaled = true;
        }
    });

    proc.on("exit", function (code) {
        if (code === 0) {
            callback();
        } else if (!errorSignaled) {
            callback("Error code: " + code);
            errorSignaled = true;
        }
    });
}

module.exports = {
    checkCopyright: checkCopyright,
    checkImports: checkImports,
    executeCommand: executeCommand
};