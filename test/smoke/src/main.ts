/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as fs from "fs";
import * as path from "path";
import * as minimist from "minimist";
import * as tmp from "tmp";
import * as rimraf from "rimraf";
import { SpectronApplication, Quality } from "./spectron/application";

import { setup as setupDataDebugTests } from "./areas/debug/debug.test";
// import './areas/terminal/terminal.test';

const tmpDir = tmp.dirSync({ prefix: "t" }) as { name: string; removeCallback: Function; };
const testDataPath = tmpDir.name;
process.once("exit", () => rimraf.sync(testDataPath));

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

let testCodePath = opts.build;
let stableCodePath = opts["stable-build"];
let electronPath: string;
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

const userDataDir = path.join(testDataPath, "d");

let quality: Quality;
if (process.env.VSCODE_DEV === "1") {
    quality = Quality.Dev;
} else if (electronPath.indexOf("Code - Insiders") >= 0 /* macOS/Windows */ || electronPath.indexOf("code-insiders") /* Linux */ >= 0) {
    quality = Quality.Insiders;
} else {
    quality = Quality.Stable;
}

// function toUri(path: string): string {
//     if (process.platform === "win32") {
//         return `${path.replace(/\\/g, "/")}`;
//     }

//     return `${path}`;
// }

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

function createApp(quality: Quality): SpectronApplication | null {
    const path = quality === Quality.Stable ? stablePath : electronPath;

    if (!path) {
        return null;
    }

    return new SpectronApplication({
        quality,
        electronPath: path,
        workspacePath,
        userDataDir,
        extensionsPath,
        artifactsPath,
        workspaceFilePath,
        waitTime:  20,
    });
}

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
