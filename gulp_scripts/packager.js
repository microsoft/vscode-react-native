const gulp = require("gulp");
const path = require("path");
const GulpExtras = require("../tools/gulp-extras");
const executeCommand = GulpExtras.executeCommand;

function package(cb) {
    const command = path.join("./node_modules", ".bin", "vsce");
    const args = ["package"];
    executeCommand(command, args, cb);
}

module.exports = {
    package,
};
