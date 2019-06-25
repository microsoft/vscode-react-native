// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.

import * as remote from "gulp-remote-src-vscode";
import * as vzip from "gulp-vinyl-zip";
import * as vfs from "vinyl-fs";
import * as untar from "gulp-untar";
import * as gunzip from "gulp-gunzip";
import * as chmod from "gulp-chmod";
import * as filter from "gulp-filter";
import * as path from "path";
import * as utilities from "./utilities";
import * as request from "request";
import * as source from "vinyl-source-stream";
import * as https from "https";
import * as fs from "fs";
import * as rimraf from "rimraf";
import { spawnSync } from "../helpers/utilities";

export class VSCodeHelper {
    private static version = process.env.CODE_VERSION || "*";
    private static isInsiders = VSCodeHelper.version === "insiders";
    private static downloadPlatform = (process.platform === "darwin") ? "darwin" : process.platform === "win32" ? "win32-x64-archive" : "linux-x64";
    private static artifactsFolderName = "drop-win";

    public static async downloadVSCodeExecutable(targetFolder: string): Promise<any> {
        const testRunFolder = path.join(targetFolder, ".vscode-test", VSCodeHelper.isInsiders ? "insiders" : "stable");

        return new Promise ((resolve) => {
            VSCodeHelper.getDownloadUrl((downloadUrl) => {
                console.log("*** Downloading VS Code into \"" + testRunFolder + "\" from: " + downloadUrl);

                let version = downloadUrl.match(/\d+\.\d+\.\d+/)[0].split("\.");
                let isTarGz = downloadUrl.match(/linux/) && version[0] >= 1 && version[1] >= 5;

                let stream;
                if (isTarGz) {
                    let gulpFilter = filter(["VSCode-linux-x64/bin/*", "VSCode-linux-x64/code", "VSCode-linux-x64/code-insiders", "VSCode-linux-x64/resources/app/node_modules*/vscode-ripgrep/**/rg"], { restore: true });
                    stream = request(utilities.toRequestOptions(downloadUrl))
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

    public static async fetchKeybindings(keybindingsPath: string) {
        const keybindingsUrl = `https://raw.githubusercontent.com/Microsoft/vscode-docs/master/build/keybindings/doc.keybindings.${VSCodeHelper.getKeybindingPlatform()}.json`;
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

    public static installExtensionFromVSIX(extensionDir: string, testVSCodeExecutablePath: string, resourcesPath: string, deleteVSIX: boolean) {
        let args: string[] = [];
        args.push(`--extensions-dir=${extensionDir}`);
        const artifactPath = path.join(resourcesPath, VSCodeHelper.artifactsFolderName);
        let extensionFile = utilities.findFile(artifactPath, /.*\.(vsix)/);
        if (!extensionFile) {
            throw new Error(`React Native extension .vsix is not found in ${resourcesPath}`);
        }

        extensionFile = path.join(artifactPath, extensionFile);
        args.push(`--install-extension=${extensionFile}`);
        console.log(`*** Installing extension to VS Code using command: ${testVSCodeExecutablePath} ${args.join(" ")}`);
        spawnSync(testVSCodeExecutablePath, args, {stdio: "inherit"});

        if (deleteVSIX) {
            console.log(`*** Deleting ${extensionFile} after installation`);
            rimraf.sync(extensionFile);
        } else {
            console.log("*** --dont-delete-vsix parameter is set, skipping deleting of VSIX");
        }
    }

    private static getKeybindingPlatform(): string {
        switch (process.platform) {
            case "darwin": return "osx";
            case "win32": return "win";
            default: return process.platform;
        }
    }

    private static getDownloadUrl(cb) {
        VSCodeHelper.getTag(function (tag) {
            // TODO: Update download endpoint azurewebsites.net -> visualstudio.com (https://github.com/microsoft/vscode-test/blob/b8813110b229fa1a524650c16ec521df42b7893d/lib/util.ts#L23)
            return cb(["https://vscode-update.azurewebsites.net", tag, VSCodeHelper.downloadPlatform, (VSCodeHelper.isInsiders ? "insider" : "stable")].join("/"));
        });
    }

    private static getTag(cb) {
        if (VSCodeHelper.version !== "*" && VSCodeHelper.version !== "insiders") {
            return cb(VSCodeHelper.version);
        }

        utilities.getContents("https://vscode-update.azurewebsites.net/api/releases/" + (VSCodeHelper.isInsiders ? "insider/" : "stable/") + VSCodeHelper.downloadPlatform, null, null, function (error, tagsRaw) {
            if (error) {
                VSCodeHelper.exitWithError(error);
            }

            try {
                cb(JSON.parse(tagsRaw)[0]); // first one is latest
            } catch (error) {
                VSCodeHelper.exitWithError(error);
            }
        });
    }

    private static exitWithError(error) {
        console.error("Error while downloading VS Code: " + error.toString());
        process.exit(1);
    }
}
