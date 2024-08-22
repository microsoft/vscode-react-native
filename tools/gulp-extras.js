// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.
"use strict";

const child_process = require("child_process");
const fs = require("fs");
const log = require('fancy-log');
const colors = require('ansi-colors');
const path = require("path");
const PluginError = require('plugin-error');
const through = require("through2");

/**
 * Pretty logger using 'log'
 * @param {string} pluginName Name of the pluginName
 * @param {Object} file A gulp file to report on
 * @param {string} message The error message to display
 */
function logError(pluginName, file, message) {
    const sourcePath = path.relative(__dirname, file.path).replace("../", ""); // CodeQL [js/incomplete-sanitization] Debugging extension has no need to use global replacement in file path string
    log(`[${colors.cyan(pluginName)}] ${colors.red("error")} ${sourcePath}: ${message}`);
}

/**
 * Plugin to verify the Microsoft copyright notice is present
 */
function checkCopyright() {
    const pluginName = "check-copyright";
    let hadErrors = false;
    const copyrightNotice = "// Copyright (c) Microsoft Corporation. All rights reserved.\n// Licensed under the MIT license. See LICENSE file in the project root for details.";

    return through.obj(function (file, encoding, callback) {
        if (file.isBuffer()) {
            let fileContents = file.contents.toString(encoding);
            fileContents = fileContents.replace("\r\n", "\n");
            fileContents = fileContents.replace("\"use strict\";\n", "");
            fileContents = fileContents.replace("Object.defineProperty(exports, \"__esModule\", { value: true });\n", "");

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
        const fileName = path.basename(filePath);
        return fs.readdirSync(path.dirname(filePath)).indexOf(fileName) !== -1;
    }

    return false;
}

function executeCommand(command, args, callback, opts) {
    const proc = child_process.spawn(command + (process.platform === "win32" ? ".cmd" : ""), args, Object.assign({}, opts, { shell: true }));
    let errorSignaled = false;

    proc.stdout.on("data", (data) => {
        log(`${data}`);
    });

    proc.stderr.on("data", (data) => {
        log.error(`${data}`);
    });

    proc.on("error", (error) => {
        if (!errorSignaled) {
            callback(`An error occurred. ${error}`);
            errorSignaled = true;
        }
    });

    proc.on("exit", (code) => {
        if (code === 0) {
            callback();
        } else if (!errorSignaled) {
            callback(`Error code: ${code}`);
            errorSignaled = true;
        }
    });
}

module.exports = {
    checkCopyright,
    executeCommand
}