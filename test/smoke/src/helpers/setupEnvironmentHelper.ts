/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
const remote = require("gulp-remote-src-vscode");
const vzip = require("gulp-vinyl-zip");
const vfs = require("vinyl-fs");
const untar = require("gulp-untar");
const gunzip = require("gulp-gunzip");
const chmod = require("gulp-chmod");
const filter = require("gulp-filter");
const path = require("path");
const shared = require("./shared");
const request = require("request");
const source = require("vinyl-source-stream");

const version = process.env.CODE_VERSION || "*";
const isInsiders = version === "insiders";
const downloadPlatform = (process.platform === "darwin") ? "darwin" : process.platform === "win32" ? "win32-archive" : "linux-x64";
export async function downloadVSCodeExecutable(targetFolder: string) {

    const testRunFolder = path.join(targetFolder, ".vscode-test", isInsiders ? "insiders" : "stable");

    return new Promise ((resolve, reject) => {
        getDownloadUrl((downloadUrl) => {
        console.log("Downloading VS Code into \"" + testRunFolder + "\" from: " + downloadUrl);

        let version = downloadUrl.match(/\d+\.\d+\.\d+/)[0].split("\.");
        let isTarGz = downloadUrl.match(/linux/) && version[0] >= 1 && version[1] >= 5;

        let stream;
        if (isTarGz) {
            let gulpFilter = filter(["VSCode-linux-x64/code", "VSCode-linux-x64/code-insiders", "VSCode-linux-x64/resources/app/node_modules*/vscode-ripgrep/**/rg"], { restore: true });
            stream = request(shared.toRequestOptions(downloadUrl))
                .pipe(source(path.basename(downloadUrl)))
                .pipe(gunzip())
                .pipe(untar())
                .pipe(gulpFilter)
                .pipe(chmod(493)) // 0o755
                .pipe(gulpFilter.restore)
                .pipe(vfs.dest(testRunFolder));
        } else {
            stream = remote("", { base: downloadUrl })
                .pipe(vzip.src())
                .pipe(vfs.dest(testRunFolder));
        }
        stream.on("end", () => {
            resolve();
            });

        });
    });
}

function getDownloadUrl(clb) {

    getTag(function (tag) {
        return clb(["https://vscode-update.azurewebsites.net", tag, downloadPlatform, (isInsiders ? "insider" : "stable")].join("/"));
    });
}

function getTag(clb) {
    if (version !== "*" && version !== "insiders") {
        return clb(version);
    }

    shared.getContents("https://vscode-update.azurewebsites.net/api/releases/" + (isInsiders ? "insider/" : "stable/") + downloadPlatform, null, null, function (error, tagsRaw) {
        if (error) {
            exitWithError(error);
        }

        try {
            clb(JSON.parse(tagsRaw)[0]); // first one is latest
        } catch (error) {
            exitWithError(error);
        }
    });

}

function exitWithError(error) {
    console.error("Error running tests: " + error.toString());
    process.exit(1);
}