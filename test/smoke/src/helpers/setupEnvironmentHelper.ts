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
import * as shared from "./shared";
import * as request from "request";
import * as source from "vinyl-source-stream";
import * as https from "https";
import * as fs from "fs";
import * as rimraf from "rimraf";
import * as cp from "child_process";
import { smokeTestsConstants } from "./smokeTestsConstants";

const version = process.env.CODE_VERSION || "*";
const isInsiders = version === "insiders";
const downloadPlatform = (process.platform === "darwin") ? "darwin" : process.platform === "win32" ? "win32-archive" : "linux-x64";
const artifactsFolderName = "drop-win";
const androidEmulatorPort = 5554;
export const androidEmulatorName = `emulator-${androidEmulatorPort}`;

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

export function installExtensionFromVSIX(extensionDir: string, testVSCodeExecutablePath: string, resourcesPath: string, isInsiders: boolean) {
    let args: string[] = [];
    args.push(`--extensions-dir=${extensionDir}`);
    const artifactPath = path.join(resourcesPath, artifactsFolderName);
    const dirFiles = fs.readdirSync(artifactPath);
    let extensionFile = dirFiles.find((elem) => {
        return /.*\.(vsix)/.test(elem);
    });
    if (!extensionFile) {
        throw new Error(`React Native extension .vsix is not found in ${resourcesPath}`);
    }

    extensionFile = path.join(artifactPath, extensionFile);
    args.push(`--install-extension=${extensionFile}`);
    const codeExecutableScript = isInsiders ? "code-insiders" : "code";
    testVSCodeExecutablePath = path.join(testVSCodeExecutablePath, codeExecutableScript);
    if (process.platform === "win32") {
        testVSCodeExecutablePath += ".cmd";
    }
    console.log(`*** Installing ${extensionFile} into ${extensionDir} using ${testVSCodeExecutablePath} executable`);
    cp.spawnSync(testVSCodeExecutablePath, args, {stdio: "inherit"});
    if (!process.argv.includes("--dont-delete-vsix")) {
        console.log(`*** Deleting ${extensionFile} after installation`);
        rimraf.sync(extensionFile);
    } else {
        console.log("*** --dont-delete-vsix parameter is set, skipping deleting of VSIX");
    }
}

export async function runAndroidEmulator() {
    if (!process.env.ANDROID_EMULATOR) {
        throw new Error("Environment variable 'ANDROID_EMULATOR' is not set. Exiting...");
    }
    terminateAndroidEmulator();
    console.log(`*** Executing Android emulator with 'emulator -avd ${process.env.ANDROID_EMULATOR}' command...`);
    // Boot options for emulator - https://developer.android.com/studio/run/emulator-commandline
    const emulatorOpts = ["-avd",
     process.env.ANDROID_EMULATOR || "",
     "-gpu", "swiftshader_indirect",
     "-wipe-data",
     "-port", androidEmulatorPort.toString(),
     "-no-snapshot",
     "-no-boot-anim",
     "-no-audio"];
    const proc = cp.spawn("emulator", emulatorOpts, {stdio: "pipe"});
    let started = false;
    proc.stdout.on("data", (chunk) => {
        process.stdout.write(chunk);
        if (/boot completed/.test(chunk.toString().trim())) {
            started = true;
        }
    });

    console.log(`*** Waiting for emulator to load (timeout is ${smokeTestsConstants.emulatorLoadTimeout}ms)`);
    let awaitRetries: number = smokeTestsConstants.emulatorLoadTimeout / 1000;
    let retry = 1;
    await new Promise((resolve, reject) => {
        let check = setInterval(async () => {
            if (started) {
                clearInterval(check);
                console.log("*** Emulator finished loading, waiting for 2 seconds");
                await sleep(2000);
                resolve();
            } else {
                retry++;
                if (retry >= awaitRetries) {
                    // When time's up just let it go - emulator should have started at this time
                    // The reason why std check didn't work is more likely that extra logging (INFO level) for emulator was disabled
                    clearInterval(check);
                    resolve();
                }
            }
        }, 1000);
    });
}

// Await function
export async function sleep(time: number) {
    await new Promise(resolve => {
        const timer = setTimeout(() => {
        clearTimeout(timer);
        resolve();
        }, time);
    });
}

// Terminates emulator "emulator-PORT" if it exists, where PORT is 5554 by default
export function terminateAndroidEmulator() {
    let devices = cp.execSync("adb devices").toString().trim();
    console.log("*** Checking for running emulators...");
    if (devices !== "List of devices attached") {
        // Check if we already have a running emulator, and terminate it if it so
        console.log(`Terminating Android '${androidEmulatorName}'...`);
        cp.execSync(`adb -s ${androidEmulatorName} emu kill`, {stdio: "inherit"});
    }
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
