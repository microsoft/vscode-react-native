/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as fs from "fs";
import * as https from "https";
// import * as cp from "child_process";
import * as path from "path";
import * as minimist from "minimist";
import * as setupEnvironmentHelper from "./helpers/setupEnvironmentHelper";
import { SpectronApplication, Quality } from "./spectron/application";

import { setup as setupDataDebugTests } from "./debug.test";
// import './areas/terminal/terminal.test';

const [, , ...args] = process.argv;
const opts = minimist(args, {
    string: [
        "build",
        "stable-build",
        "log",
        "wait-time",
    ],
});

const artifactsPath = opts.log || "";

function fail(errorMessage): void {
    console.error(errorMessage);
    process.exit(1);
}

if (parseInt(process.version.substr(1)) < 6) {
    fail("Please update your Node version to greater than 6 to run the smoke test.");
}

function getBuildElectronPath(root: string): string {
    switch (process.platform) {
        case "darwin":
            return path.join(root, "Contents", "MacOS", "Electron");
        case "linux": {
            const product = require(path.join(root, "resources", "app", "product.json"));
            return path.join(root, product.applicationName);
        }
        case "win32": {
            const product = require(path.join(root, "resources", "app", "product.json"));
            return path.join(root, `${product.nameShort}.exe`);
        }
        default:
            throw new Error("Unsupported platform.");
    }
}

const testDataPath = path.join(__dirname, "..", "..", "..", ".vscode-test", "insiders");
let testCodePath = opts.build;
let stableCodePath = opts["stable-build"];
let electronPath: string = testDataPath;
let stablePath: string;

if (testCodePath) {
    electronPath = getBuildElectronPath(testCodePath);

    if (stableCodePath) {
        stablePath = getBuildElectronPath(stableCodePath);
    }
}

if (!fs.existsSync(electronPath || "")) {
    fail(`Can't find Code at ${electronPath}.`);
}


let quality: Quality;
if (process.env.VSCODE_DEV === "1") {
    quality = Quality.Dev;
} else if (electronPath.indexOf("Code - Insiders") >= 0 /* macOS/Windows */ || electronPath.indexOf("code-insiders") /* Linux */ >= 0) {
    quality = Quality.Insiders;
} else {
    quality = Quality.Stable;
}

/**
 * WebDriverIO 4.8.0 outputs all kinds of "deprecation" warnings
 * for common commands like `keys` and `moveToObject`.
 * According to https://github.com/Codeception/CodeceptJS/issues/531,
 * these deprecation warnings are for Firefox, and have no alternative replacements.
 * Since we can't downgrade WDIO as suggested (it's Spectron's dep, not ours),
 * we must suppress the warning with a classic monkey-patch.
 *
 * @see webdriverio/lib/helpers/depcrecationWarning.js
 * @see https://github.com/webdriverio/webdriverio/issues/2076
 */
// Filter out the following messages:
const wdioDeprecationWarning = /^WARNING: the "\w+" command will be deprecated soon../; // [sic]
// Monkey patch:
const warn = console.warn;
console.warn = function suppressWebdriverWarnings(message) {
    if (wdioDeprecationWarning.test(message)) { return; }
    warn.apply(console, arguments);
};


const userDataDir = path.join(testDataPath, "d");
let workspacePath = path.join(__dirname, "..", "..", "resources", "latestRNApp");
let extensionsPath = path.join(__dirname, "..", "..", "..", "..", ".vscode-insiders", "extensions");
let workspaceFilePath = path.join(__dirname, "..", "..", "resources", "latestRNApp", "src", "app.js");

const keybindingsPath = path.join(__dirname, "keybindings.json");
process.env.VSCODE_KEYBINDINGS_PATH = keybindingsPath;

function createApp(quality: Quality): SpectronApplication | null {
    const vscodePath = quality === Quality.Stable ? stablePath : electronPath;

    if (!vscodePath) {
        return null;
    }

    return new SpectronApplication({
        quality,
        electronPath: vscodePath,
        workspacePath,
        userDataDir,
        extensionsPath,
        artifactsPath,
        workspaceFilePath,
        waitTime:  150,
    });
}

function getKeybindingPlatform(): string {
    switch (process.platform) {
        case "darwin": return "osx";
        case "win32": return "win";
        default: return process.platform;
    }
}

async function setup(): Promise<void> {
    console.log("*** Test data:", testDataPath);
    console.log("*** Preparing smoketest setup...");

    await setupEnvironmentHelper.downloadVSCodeExecutable(path.join(__dirname, "..", "..", ".."));
    const keybindingsUrl = `https://raw.githubusercontent.com/Microsoft/vscode-docs/master/build/keybindings/doc.keybindings.${getKeybindingPlatform()}.json`;
    console.log("*** Fetching keybindings...");

    await new Promise((c, e) => {
        https.get(keybindingsUrl, res => {
            const output = fs.createWriteStream(keybindingsPath);
            res.on("error", e);
            output.on("error", e);
            output.on("close", c);
            res.pipe(output);
        }).on("error", e);
    });

    // console.log("*** Running npm install...");
    // cp.execSync("npm install", { cwd: workspacePath, stdio: "inherit" });

    console.log("*** Smoketest setup done!\n");
}

before(async function () {
    // allow two minutes for setup
    this.timeout(2 * 60 * 1000);
    await setup();
});

describe("Everything Else", () => {
    before(async function () {
        const app = createApp(quality);
        await app!.start();
        this.app = app;
    });

    after(async function () {
        await this.app.stop();
    });

    setupDataDebugTests();
});
