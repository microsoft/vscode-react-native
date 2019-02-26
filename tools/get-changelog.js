// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.

// Script for getting changelog for particular version from CHANGELOG.MD
// It takes two parameters:
// * path to CHANGELOG.MD
// * version
// CHANGELOG.MD should be in proper format:
// * Versions markers must starts with `## `, for example `## 1.5.6`
// * Versions must be like NUMBER.NUMBER.NUMBER
// * Changelog content must not include reference to other version markers like `* Please see, ## 1.2.3 for more info`

const fs = require("fs");

if (process.argv.length < 3) {
    console.error("Please, specify path to the changelog file");
    process.exit(1);
}

if (process.argv.length < 4) {
    console.error("Please, specify version");
    process.exit(1);
}

const changelogFile = process.argv[2];
const content = fs.readFileSync(changelogFile).toString();

const version = process.argv[3];

// Check how many versions already in changelog by counting version markers like "## 1.0.0".
const matches = content.match(/^## \d+\.\d+\.\d+$/gm) || [];
let versionChangelog;
if (matches.length == 0) {
    console.error("No version markers were found in the changelog file");
    process.exit(1);
} else {
    // Check where specified version is located
    const versionMarker = `## ${version}`;
    // Escape dots
    const versionMarkerPattern = versionMarker.replace(/\./g, "\\.");
    const index = matches.indexOf(versionMarker);
    if (index === - 1) {
        console.error("No version markers were found in the changelog file that would match specified version");
        process.exit(1);
    } else if (index === matches.length - 1) {
        // If it's located at the end, it means that this is the first version mentioned in changelog
        // Then cut everything after the specified version marker up to the end of the file
        const exactVersionPattern = new RegExp(versionMarkerPattern);
        // Find position of marker in the text
        const position = exactVersionPattern.exec(content).index;
        // Cut and clean
        versionChangelog = content.substr(position).replace(exactVersionPattern, "").trim();
    } else {
        // If not, then cut everything between specified version marker and previous version marker
        const betweenTwoVersionsPattern = new RegExp(`${versionMarkerPattern}((.|(\\r\\n|\\r|\\n))*?)## \\d+\.\\d+\.\\d+`, "gm");
        const matches = betweenTwoVersionsPattern.exec(content) || [];
        if (matches.length === 0 || matches[1].trim() === "") {
            console.error(`No changelog content found or empty between ${version} and previous version`);
            process.exit(1);
        }
        versionChangelog = matches[1].trim();
    }
    process.stdout.write(versionChangelog);
}