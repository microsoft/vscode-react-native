// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.

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
const https = require("https");
const fs = require("fs");
const cp = require("child_process");
const rimraf = require("rimraf");


const version = process.env.CODE_VERSION || "*";
const isInsiders = version === "insiders";
const downloadPlatform = (process.platform === "darwin") ? "darwin" : process.platform === "win32" ? "win32-archive" : "linux-x64";
export async function downloadVSCodeExecutable(targetFolder: string): Promise<any> {

    const testRunFolder = path.join(targetFolder, ".vscode-test", isInsiders ? "insiders" : "stable");

    return new Promise ((resolve, reject) => {
        getDownloadUrl((downloadUrl) => {
        console.log("*** Downloading VS Code into \"" + testRunFolder + "\" from: " + downloadUrl);

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

export async function fetchKeybindings(keybindingsPath: string) {
    const keybindingsUrl = `https://raw.githubusercontent.com/Microsoft/vscode-docs/master/build/keybindings/doc.keybindings.${getKeybindingPlatform()}.json`;
    console.log(`*** Fetching keybindings into ${keybindingsPath}` );

    await new Promise((cb, err) => {
        https.get(keybindingsUrl, res => {
            const output = fs.createWriteStream(keybindingsPath);
            res.on("error", err);
            output.on("error", err);
            output.on("close", cb);
            res.pipe(output);
        }).on("error", err);
    });
}

export function prepareReactNativeApplication(workspaceFilePath: string, resourcesPath: string, workspacePath: string, appName: string) {
    console.log(`*** Creating RN app via 'react-native init ${appName}' in ${workspacePath}...`);
    cp.execSync(`react-native init ${appName}`, { cwd: resourcesPath, stdio: "inherit" });

    let customEntryPointFile = path.join(resourcesPath, "App.js");
    let launchConfigFile = path.join(resourcesPath, "launch.json");
    let vsCodeConfigPath = path.join(workspacePath, ".vscode");

    console.log(`*** Copying  ${customEntryPointFile} into ${workspaceFilePath}...`);
    fs.writeFileSync(workspaceFilePath, fs.readFileSync(customEntryPointFile));

    if (!fs.existsSync(vsCodeConfigPath)) {
        console.log(`*** Creating  ${vsCodeConfigPath}...`);
        fs.mkdirSync(vsCodeConfigPath);
    }

    console.log(`*** Copying  ${launchConfigFile} into ${vsCodeConfigPath}...`);
    fs.writeFileSync(path.join(vsCodeConfigPath, "launch.json"), fs.readFileSync(launchConfigFile));
}

export function cleanUp(testVSCodeExecutableFolder: string, workspacePath: string) {
    console.log("\n*** Clean up...");
    if (fs.existsSync(testVSCodeExecutableFolder)) {
        console.log(`*** Deleting test VS Code directory: ${testVSCodeExecutableFolder}`);
        rimraf.sync(testVSCodeExecutableFolder);
    }
    if (fs.existsSync(workspacePath)) {
        console.log(`*** Deleting test React Native application: ${workspacePath}`);
        rimraf.sync(workspacePath);
    }
}

function getKeybindingPlatform(): string {
    switch (process.platform) {
        case "darwin": return "osx";
        case "win32": return "win";
        default: return process.platform;
    }
}

function getDownloadUrl(cb) {

    getTag(function (tag) {
        return cb(["https://vscode-update.azurewebsites.net", tag, downloadPlatform, (isInsiders ? "insider" : "stable")].join("/"));
    });
}

function getTag(cb) {
    if (version !== "*" && version !== "insiders") {
        return cb(version);
    }

    shared.getContents("https://vscode-update.azurewebsites.net/api/releases/" + (isInsiders ? "insider/" : "stable/") + downloadPlatform, null, null, function (error, tagsRaw) {
        if (error) {
            exitWithError(error);
        }

        try {
            cb(JSON.parse(tagsRaw)[0]); // first one is latest
        } catch (error) {
            exitWithError(error);
        }
    });

}

function exitWithError(error) {
    console.error("Error running tests: " + error.toString());
    process.exit(1);
}
