// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.

const gulp = require("gulp");
const log = require("fancy-log");
const path = require("path");
const { series } = require("gulp");

global.appRoot = path.resolve(__dirname);

const getFormatter = require("./gulp_scripts/formatter");
const getWebpackBundle = require("./gulp_scripts/webpackBundle");
const getCleaner = require("./gulp_scripts/cleaner");
const getBuilder = require("./gulp_scripts/builder");
const getTester = require("./gulp_scripts/tester");
const getWatcher = require("./gulp_scripts/watcher");
const getPacker = require("./gulp_scripts/packer");
const getRelease = require("./gulp_scripts/release");
const getTranslator = require("./gulp_scripts/translator");

module.exports = {
    "format:prettier": getFormatter.formatPrettier,
    "format:eslint": getFormatter.formatEslint,
    format: getFormatter.format,
    "lint:prettier": getFormatter.lintPrettier,
    "lint:eslint": getFormatter.lintEslint,
    lint: getFormatter.lint,
    "webpack-bundle": getWebpackBundle.webpackBundle,
    clean: getCleaner.clean,
    build: getBuilder.buildTask,
    "build-dev": getBuilder.buildDev,
    "quick-build": gulp.series(getBuilder.buildDev),
    watch: getWatcher.watch,
    "prod-build": getBuilder.buildProd,
    default: gulp.series(getBuilder.buildProd),
    test: getTester.test,
    "test-no-build": getTester.test,
    "test:coverage": getTester.testCoverage,
    "watch-build-test": getWatcher.watchBuildTest,
    package: getPacker.package,
    release: getRelease.release,
    "add-i18n": getTranslator.addi18n,
    "translations-export": getTranslator.translationsExport,
    "translations-import": getTranslator.translationImport,
};
