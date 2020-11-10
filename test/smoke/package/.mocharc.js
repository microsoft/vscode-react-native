"use strict";

module.exports = {
    ui: "bdd",
    reporter: "mocha-multi-reporters",
    reporterOptions: {
        reporterEnabled: "spec, mocha-junit-reporter",
    },
    color: true,
    exit: true,
    file: ["out/main.js"],
    extension: ["js"],
    slow: 200000,
    timeout: 120000
};
