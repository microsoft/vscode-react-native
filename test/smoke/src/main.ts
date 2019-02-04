// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.

import * as fs from "fs";
import * as path from "path";
import * as minimist from "minimist";
import * as setupEnvironmentHelper from "./helpers/setupEnvironmentHelper";
import { SpectronApplication, Quality } from "./spectron/application";
import { setup as setupDataDebugTests } from "./debug.test";


const [, , ...args] = process.argv;
const opts = minimist(args);

const artifactsPath = opts.log || "";

function fail(errorMessage): void {
    console.error(errorMessage);
    process.exit(1);
}

if (parseInt(process.version.substr(1)) < 8) {
    fail("Please update your Node version to greater than 8 to run the smoke test.");
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
const repoRoot = path.join(__dirname, "..", "..", "..");
const isInsiders = process.env.CODE_VERSION === "insiders";
let testVSCodeExecutableFolder;
if (!isInsiders) {
     testVSCodeExecutableFolder = path.join(repoRoot, ".vscode-test", "stable");
} else {
    testVSCodeExecutableFolder = path.join(repoRoot, ".vscode-test", "insiders");
}

let executablePath: string;

let quality: Quality;
if (isInsiders) {
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

const userDataDir = path.join(testVSCodeExecutableFolder, "userTmpFolder");
const workspacePath = path.join(__dirname, "latestRNApp");
const extensionsPath = path.join(testVSCodeExecutableFolder, "extensions");
const workspaceFilePath = path.join(workspacePath, "src", "App.js");

const keybindingsPath = path.join(userDataDir, "keybindings.json");
process.env.VSCODE_KEYBINDINGS_PATH = keybindingsPath;


function createApp(quality: Quality): SpectronApplication | null {

    if (!executablePath) {
        return null;
    }

    return new SpectronApplication({
        quality,
        electronPath: executablePath,
        workspacePath,
        userDataDir,
        extensionsPath,
        artifactsPath,
        workspaceFilePath,
        waitTime:  150,
    });
}



async function setup(): Promise<void> {
    console.log("*** Test data:", testVSCodeExecutableFolder);
    console.log("*** Preparing smoke tests setup...");
    if (!fs.existsSync(workspacePath)) {
        console.log(`*** Creating workspace directory: ${workspacePath}`);
        fs.mkdirSync(workspacePath);
    }
    await setupEnvironmentHelper.downloadVSCodeExecutable(repoRoot);
    if (!fs.existsSync(userDataDir)) {
        console.log(`*** Creating VS Code user data directory: ${userDataDir}`);
        fs.mkdirSync(userDataDir);
    }
    await setupEnvironmentHelper.fetchKeybindings(keybindingsPath);

    // console.log("*** Running npm install...");
    // cp.execSync("npm install", { cwd: workspacePath, stdio: "inherit" });

    console.log("*** Smoke tests setup done!\n");
}

before(async function () {
    // allow two minutes for setup
    this.timeout(2 * 60 * 1000);
    await setup();
    executablePath = getBuildElectronPath(testVSCodeExecutableFolder);

    if (!fs.existsSync(testVSCodeExecutableFolder || "")) {
        fail(`Can't find VS Code executable at ${testVSCodeExecutableFolder}.`);
    }
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
