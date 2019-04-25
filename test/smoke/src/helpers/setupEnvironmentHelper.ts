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
import { SmokeTestsConstants } from "./smokeTestsConstants";
import { AppiumHelper } from "./appiumHelper";
import * as kill from "tree-kill";
import { spawnSync } from "../helpers/utilities";
import * as semver from "semver";
import { IosSimulatorHelper } from "./iosSimulatorHelper";

const version = process.env.CODE_VERSION || "*";
const isInsiders = version === "insiders";
const downloadPlatform = (process.platform === "darwin") ? "darwin" : process.platform === "win32" ? "win32-x64-archive" : "linux-x64";
const artifactsFolderName = "drop-win";
export const expoPackageName = "host.exp.exponent";
const androidEmulatorPort = 5554;
export const androidEmulatorName = `emulator-${androidEmulatorPort}`;

export async function downloadVSCodeExecutable(targetFolder: string): Promise<any> {

    const testRunFolder = path.join(targetFolder, ".vscode-test", isInsiders ? "insiders" : "stable");

    return new Promise ((resolve) => {
        getDownloadUrl((downloadUrl) => {
            console.log("*** Downloading VS Code into \"" + testRunFolder + "\" from: " + downloadUrl);

            let version = downloadUrl.match(/\d+\.\d+\.\d+/)[0].split("\.");
            let isTarGz = downloadUrl.match(/linux/) && version[0] >= 1 && version[1] >= 5;

            let stream;
            if (isTarGz) {
                let gulpFilter = filter(["VSCode-linux-x64/bin/*", "VSCode-linux-x64/code", "VSCode-linux-x64/code-insiders", "VSCode-linux-x64/resources/app/node_modules*/vscode-ripgrep/**/rg"], { restore: true });
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

export function prepareReactNativeApplication(workspaceFilePath: string, resourcesPath: string, workspacePath: string, appName: string, version?: string) {
    let command = `react-native init ${appName}`;
    if (version) {
        command += ` --version ${version}`;
    }
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
    console.log(`*** Creating Expo app via '${command}' in ${workspacePath}...`);
    cp.execSync(command, { cwd: resourcesPath, stdio: "inherit" });

    const customEntryPointFile = path.join(resourcesPath, "ExpoSample", "App.js");
    const launchConfigFile = path.join(resourcesPath, "launch.json");
    const vsCodeConfigPath = path.join(workspacePath, ".vscode");

    console.log(`*** Copying  ${customEntryPointFile} into ${workspaceFilePath}...`);
    fs.writeFileSync(workspaceFilePath, fs.readFileSync(customEntryPointFile));

    if (!fs.existsSync(vsCodeConfigPath)) {
        console.log(`*** Creating  ${vsCodeConfigPath}...`);
        fs.mkdirSync(vsCodeConfigPath);
    }

    console.log(`*** Copying  ${launchConfigFile} into ${vsCodeConfigPath}...`);
    fs.writeFileSync(path.join(vsCodeConfigPath, "launch.json"), fs.readFileSync(launchConfigFile));
}

export function addExpoDependencyToRNProject(workspacePath: string) {
    let npmCmd = "npm";
    if (process.platform === "win32") {
        npmCmd = "npm.cmd";
    }
    const command = `${npmCmd} install expo --no-save`;

    console.log(`*** Adding expo dependency to ${workspacePath} via '${command}' command...`);
    cp.execSync(command, { cwd: workspacePath, stdio: "inherit" });
}

// Installs Expo app on Android device via "expo android" command
export async function installExpoAppOnAndroid(expoAppPath: string) {
    console.log(`*** Installing Expo app (${expoPackageName}) on android device with 'expo-cli android' command`);
    let expoCliCommand = process.platform === "win32" ? "expo-cli.cmd" : "expo-cli";
    let installerProcess = cp.spawn(expoCliCommand, ["android"], {cwd: expoAppPath, stdio: "inherit"});
    installerProcess.on("close", () => {
        console.log("*** expo-cli terminated");
    });
    installerProcess.on("error", (error) => {
        console.log("Error occurred in expo-cli process: ", error);
    });
    await AppiumHelper.checkIfAndroidAppIsInstalled(expoPackageName, 100 * 1000);
    kill(installerProcess.pid, "SIGINT");
    await sleep(1000);
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
        return /.*\.(vsix)/.test(elem);
    });
    if (!extensionFile) {
        throw new Error(`React Native extension .vsix is not found in ${resourcesPath}`);
    }

    extensionFile = path.join(artifactPath, extensionFile);
    args.push(`--install-extension=${extensionFile}`);
    console.log(`*** Installing extension to VS Code using command: ${testVSCodeExecutablePath} ${args.join(" ")}`);
    spawnSync(testVSCodeExecutablePath, args, {stdio: "inherit"});

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

    proc.stderr.on("data", (chunk) => {
        process.stderr.write(chunk);
    });

    console.log(`*** Waiting for emulator to load (timeout is ${SmokeTestsConstants.emulatorLoadTimeout}ms)`);
    let awaitRetries: number = SmokeTestsConstants.emulatorLoadTimeout / 1000;
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

// Terminates emulator "emulator-PORT" if it exists, where PORT is 5554 by default
export function terminateAndroidEmulator() {
    let devices = cp.execSync("adb devices").toString().trim();
    console.log("*** Checking for running android emulators...");
    if (devices !== "List of devices attached") {
        // Check if we already have a running emulator, and terminate it if it so
        console.log(`Terminating Android '${androidEmulatorName}'...`);
        cp.execSync(`adb -s ${androidEmulatorName} emu kill`, {stdio: "inherit"});
    } else {
        console.log("*** No running android emulators found");
    }
}

export async function runiOSSimulator() {
    const device = <string>IosSimulatorHelper.getDevice();
    await terminateiOSSimulator();
    // Wipe data on simulator
    await IosSimulatorHelper.eraseSimulator(device);
    console.log(`*** Executing iOS simulator with 'xcrun simctl boot "${device}"' command...`);
    await IosSimulatorHelper.runSimulator(device);
    await sleep(15 * 1000);
}

export async function terminateiOSSimulator() {
    const device = <string>IosSimulatorHelper.getDevice();
    await IosSimulatorHelper.terminateSimulator(device);
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

export function cleanUp(testVSCodeDirectory: string, testLogsDirectory: string, workspacePaths: string[]) {
    console.log("\n*** Clean up...");
    if (fs.existsSync(testVSCodeDirectory)) {
        console.log(`*** Deleting test VS Code directory: ${testVSCodeDirectory}`);
        rimraf.sync(testVSCodeDirectory);
    }
    if (fs.existsSync(testLogsDirectory)) {
        console.log(`*** Deleting test logs directory: ${testLogsDirectory}`);
        rimraf.sync(testLogsDirectory);
    }
    workspacePaths.forEach(testAppFolder => {
        if (fs.existsSync(testAppFolder)) {
            console.log(`*** Deleting test application: ${testAppFolder}`);
            rimraf.sync(testAppFolder);
        }
    });
}

export async function getLatestSupportedRNVersionForExpo(): Promise<any> {
    console.log("*** Getting latest React Native version supported by Expo...");
    return new Promise((resolve, reject) => {
        shared.getContents("https://exp.host/--/api/v2/versions", null, null, function (error, versionsContent) {
            if (error) {
                reject(error);
            }
            try {
               const content = JSON.parse(versionsContent);
               if (content.sdkVersions) {
                   const maxSdkVersion = Object.keys(content.sdkVersions).sort((ver1, ver2) => {
                       if (semver.lt(ver1, ver2)) {
                           return 1;
                       } else if (semver.gt(ver1, ver2)) {
                           return -1;
                       }
                       return 0;
                   })[0];
                   if (content.sdkVersions[maxSdkVersion]) {
                       if (content.sdkVersions[maxSdkVersion].facebookReactNativeVersion) {
                           console.log(`*** Latest React Native version supported by Expo: ${content.sdkVersions[maxSdkVersion].facebookReactNativeVersion}`);
                           resolve(content.sdkVersions[maxSdkVersion].facebookReactNativeVersion as string);
                       }
                   }
               }
               reject("Received object is incorrect");
            } catch (error) {
               reject(error);
            }
        });
    });
}

export function addIosTargetToLaunchJson(workspacePath: string) {
    let launchJsonPath = path.join(workspacePath, ".vscode", "launch.json");
    console.log(`*** Implicitly adding target to "Debug iOS" config for ${launchJsonPath}`);
    let content = JSON.parse(fs.readFileSync(launchJsonPath).toString());
    let found = false;
    for (let i = 0; i < content.configurations.length; i++) {
        if (content.configurations[i].name === "Debug iOS") {
            found = true;
            content.configurations[i].target = IosSimulatorHelper.getDevice();
        }
    }
    if (!found) {
        throw new Error("Couldn't find \"Debug iOS\" configuration");
    }
    fs.writeFileSync(launchJsonPath, JSON.stringify(content, undefined, 4)); // Adds indentations
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
