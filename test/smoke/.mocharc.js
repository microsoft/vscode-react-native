"use strict";

module.exports = {
    ui: "bdd",
    color: true,
    exit: true,
    file: ["out/main.js"],
    extension: ["js"],
    slow: 200000,
    timeout: 300000,
    spec: "./out/**/*.test.js",
    recursive: true,
};
