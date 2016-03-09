// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.

var buildConfig = require('./tsconfig.json');
var path = require("path");

function compileBuildScripts() {
    console.log("Compiling tools...\n");
    var gulp = require("gulp");
    var ts = require('gulp-typescript');
    var sourcemaps = require("gulp-sourcemaps");
    gulp.src(["src/**/*.ts"])
        .pipe(sourcemaps.init())
        .pipe(ts(buildConfig.tsCompileOptions))
        .on("error", function(error){
            if (error) {
                console.error("Failed: Compilation of tools failed.");
                process.exit(1);
            }
        })
        .pipe(sourcemaps.write("."))
        .pipe(gulp.dest(path.resolve("out")))
        .on("end", function(){
            console.log(greenColorFunction("Success!!! To build the project, run 'gulp' from the root directory"));
        });
}

function greenColorFunction(s) {
    // https://en.wikipedia.org/wiki/ANSI_escape_code#CSI_codes
    // \u001b[3Xm == "set foreground colour to colour in slot X"
    // Slot 2 defaults to green
    // \u001b[39m == "reset foreground colour"
    // \u001b[1m == "bold" which is interpreted differently by different terminals
    // \u001b[22m == "stop being bold (or faint)"
    return "\u001b[32m\u001b[1m" + s + "\u001b[22m\u001b[39m";
}

process.chdir("tools"); // Go to the tools folder

compileBuildScripts();