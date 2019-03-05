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
import { smokeTestsConstants } from "./smokeTestsConstants";
import { appiumHelper } from "./appiumHelper";

const version = process.env.CODE_VERSION || "*";
const isInsiders = version === "insiders";
const downloadPlatform = (process.platform === "darwin") ? "darwin" : process.platform === "win32" ? "win32-archive" : "linux-x64";
const artifactsFolderName = "drop-win";
export const expoPackageName = "host.exp.exponent";
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
    const command = `react-native init ${appName}`;
    console.log(`*** Creating RN app via '${command}' in ${workspacePath}...`);
    cp.execSync(command, { cwd: resourcesPath, stdio: "inherit" });

    let customEntryPointFile = path.join(resourcesPath, "ReactNativeSample", "App.js");
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

export function prepareExpoApplication(workspaceFilePath: string, resourcesPath: string, workspacePath: string, appName: string) {
    const command = `echo -ne '\\n' | expo init -t tabs --name ${appName}  --workflow managed ${appName}`;
    const installExpoCliCommand = "npm install --save-dev expo-cli";
    console.log(`*** Creating Expo app via '${command}' in ${workspacePath}...`);
    cp.execSync(command, { cwd: resourcesPath, stdio: "inherit" });
    console.log(`*** Adding expo-cli dependency via '${installExpoCliCommand}' in ${workspacePath}...`);
    cp.execSync(installExpoCliCommand, { cwd: workspacePath, stdio: "inherit" });

    let customEntryPointFile = path.join(resourcesPath, "ExpoSample", "App.js");
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

// Installs Expo app on Android device via Expo start command
export async function installExpoAppOnAndroid(expoAppPath: string) {
    console.log(`*** Installing Expo app (${expoPackageName}) on android device with 'expo-cli android' command`);
    let installerProcess = cp.spawn("node" , ["./node_modules/expo-cli/bin/expo.js", "android"], {cwd: expoAppPath, stdio: "inherit"});
    await appiumHelper.checkAppIsInstalled(expoPackageName, 100000);
    installerProcess.kill("SIGTERM");
    const drawPermitCommand = `adb -s ${androidEmulatorName} shell appops set ${expoPackageName} SYSTEM_ALERT_WINDOW allow`;
    console.log(`*** Enabling permission for drawing over apps via: ${drawPermitCommand}`);
    cp.execSync(drawPermitCommand, {stdio: "inherit"});
}

export function installExtensionFromVSIX(extensionDir: string, testVSCodeExecutablePath: string, resourcesPath: string, isInsiders: boolean) {
    let args: string[] = [];
    args.push(`--extensions-dir=${extensionDir}`);
    const artifactPath = path.join(resourcesPath, artifactsFolderName);
    const dirFiles = fs.readdirSync(artifactPath);
    let extensionFile = dirFiles.find((elem) => {
        return elem.match(/.*\.(vsix)/);
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
    console.log(`*** Deleting ${extensionFile} after installation`);
    rimraf.sync(extensionFile);
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
    cp.spawn("emulator", emulatorOpts, {stdio: "inherit"});

    console.log(`*** Awaiting ${smokeTestsConstants.emulatorLoadTimeout}ms for emulator load`);
    await sleep(smokeTestsConstants.emulatorLoadTimeout);
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

// Await function
export async function sleep(time: number) {
    await new Promise(resolve => {
        const timer = setTimeout(() => {
        clearTimeout(timer);
        resolve();
        }, time);
    });
}

export function cleanUp(testVSCodeExecutableFolder: string, workspacePaths: string[]) {
    console.log("\n*** Clean up...");
    if (fs.existsSync(testVSCodeExecutableFolder)) {
        console.log(`*** Deleting test VS Code directory: ${testVSCodeExecutableFolder}`);
        rimraf.sync(testVSCodeExecutableFolder);
    }
    workspacePaths.forEach(testAppFolder => {
        if (fs.existsSync(testAppFolder)) {
            console.log(`*** Deleting test application: ${testAppFolder}`);
            rimraf.sync(testAppFolder);
        }
    });
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
