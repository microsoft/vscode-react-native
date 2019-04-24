// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.

import { Application, SpectronClient as WebClient, AppConstructorOptions } from "spectron";
import { test as testPort } from "portastic";
import { SpectronClient } from "./client";
import { ScreenCapturer } from "../helpers/screenshot";
import { Workbench } from "../areas/workbench/workbench";
import * as fs from "fs";
import * as path from "path";
import * as mkdirp from "mkdirp";
import { sanitize, sleep } from "../helpers/utilities";
import { artifactsPath } from "../main";

// Just hope random helps us here, cross your fingers!
export async function findFreePort(): Promise<number> {
    for (let i = 0; i < 10; i++) {
        const port = 10000 + Math.round(Math.random() * 10000);

        if (await testPort(port)) {
            return port;
        }
    }

    throw new Error("Could not find free port!");
}

export enum Quality {
    Dev,
    Insiders,
    Stable,
}

export interface SpectronApplicationOptions {
    quality: Quality;
    electronPath: string;
    workspacePath: string;
    userDataDir: string;
    extensionsPath: string;
    artifactsPath: string;
    workspaceFilePath: string;
    waitTime: number;
}

/**
 * Wraps Spectron's Application instance with its used methods.
 */
export class SpectronApplication {

    private static count = 0;

    get quality(): Quality {
        return this.options.quality;
    }

    get client(): SpectronClient {
        return this._client;
    }

    get webclient(): WebClient {
        if (!this.spectron) {
            throw new Error("Application not started");
        }

        return this.spectron.client;
    }

    get screenCapturer(): ScreenCapturer {
        return this._screenCapturer;
    }

    get workbench(): Workbench {
        return this._workbench;
    }

    get workspacePath(): string {
        return this.options.workspacePath;
    }

    get extensionsPath(): string {
        return this.options.extensionsPath;
    }

    get userDataPath(): string {
        return this.options.userDataDir;
    }

    get workspaceFilePath(): string {
        return this.options.workspaceFilePath;
    }

    set suiteName(suiteName: string) {
        this._suiteName = suiteName;
        this._screenCapturer.suiteName = suiteName;
    }

    private _client: SpectronClient;
    private _workbench: Workbench;
    private _screenCapturer: ScreenCapturer;
    private spectron: Application | undefined;
    private keybindings: any[]; private stopLogCollection: (() => Promise<void>) | undefined;

    private _suiteName: string = "Init";

    constructor(
        private options: SpectronApplicationOptions
    ) { }

    public async start(waitForWelcome: boolean = true): Promise<any> {
        await this._start();

        if (waitForWelcome) {
            await this.waitForWelcome();
        }
    }

    public async restart(options: { workspaceOrFolder?: string, extraArgs?: string[] }): Promise<any> {
        await this.stop();
        await sleep(1 * 1000);
        await this._start(options.workspaceOrFolder, options.extraArgs);
        await sleep(5 * 1000);
    }

    public async reload(): Promise<any> {
        await this.workbench.quickopen.runCommand("Reload Window");
        // TODO @sandy: Find a proper condition to wait for reload
        await new Promise(c => setTimeout(c, 1500));
        await this.checkWindowReady();
    }

    public async stop(): Promise<any> {
        if (this.stopLogCollection) {
            await this.stopLogCollection();
            this.stopLogCollection = undefined;
        }

        if (this.spectron && this.spectron.isRunning()) {
            await this.spectron.stop();
            this.spectron = undefined;
        }
    }

    /**
     * Retrieves the command from keybindings file and executes it with WebdriverIO client API
     * @param command command (e.g. 'workbench.action.files.newUntitledFile')
     */
    public runCommand(command: string): Promise<any> {
        const binding = this.keybindings.find(x => x["command"] === command);
        if (!binding) {
            return this.workbench.quickopen.runCommand(command);
        }

        const keys: string = binding.key;
        let keysToPress: string[] = [];

        const chords = keys.split(" ");
        chords.forEach((chord) => {
            const keys = chord.split("+");
            keys.forEach((key) => keysToPress.push(this.transliterate(key)));
            keysToPress.push("NULL");
        });

        return this.client.keys(keysToPress);
    }

    private async _start(workspaceOrFolder = this.options.workspacePath, extraArgs: string[] = []): Promise<any> {
        await this.retrieveKeybindings();
        await this.startApplication(workspaceOrFolder, extraArgs);
        await this.checkWindowReady();
    }

    private async startApplication(workspaceOrFolder: string, extraArgs: string[] = []): Promise<any> {

        let args: string[] = [];

        args.push(workspaceOrFolder);

        // Prevent 'Getting Started' web page from opening on clean user-data-dir
        args.push("--skip-getting-started");

        // Prevent 'Getting Started' web page from opening on clean user-data-dir
        args.push("--skip-release-notes");

        // Prevent Quick Open from closing when focus is stolen, this allows concurrent smoketest suite running
        args.push("--sticky-quickopen");

        // Disable telemetry
        args.push("--disable-telemetry");

        // Disable updates
        args.push("--disable-updates");

        // Disable crash reporter
        // This seems to be the fix for the strange hangups in which Code stays unresponsive
        // and tests finish badly with timeouts, leaving Code running in the background forever
        args.push("--disable-crash-reporter");

        // Ensure that running over custom extensions directory, rather than picking up the one that was used by a tester previously
        args.push(`--extensions-dir=${this.options.extensionsPath}`);

        // Define a custom directory for VS Code temporary data
        args.push(`--user-data-dir=${this.options.userDataDir}`);

        args.push(...extraArgs);



        // Spectron always uses the same port number for the chrome driver
        // and it handles gracefully when two instances use the same port number
        // This works, but when one of the instances quits, it takes down
        // chrome driver with it, leaving the other instance in DISPAIR!!! :(
        const port = await findFreePort();

        const runName = String(SpectronApplication.count++);
        const extensionLogsDir = path.join(artifactsPath, runName, "extensionLogs");

        const env = {
            path: process.env.path,
            REACT_NATIVE_TOOLS_LOGS_DIR: extensionLogsDir,
        };

        const opts: AppConstructorOptions = {
            path: this.options.electronPath,
            port,
            args,
            env,
            startTimeout: 10000,
            requireName: "nodeRequire",
        };

        let testsuiteRootPath: string | undefined = undefined;
        let screenshotsDirPath: string | undefined = undefined;
        console.log(`*** Extension log files path for VS Code run #${runName}: ${extensionLogsDir}`);
        if (this.options.artifactsPath) {
            testsuiteRootPath = path.join(this.options.artifactsPath, sanitize(runName));
            mkdirp.sync(testsuiteRootPath);

            // Collect screenshots
            screenshotsDirPath = path.join(testsuiteRootPath, "screenshots");
            mkdirp.sync(screenshotsDirPath);

            // Collect chromedriver logs
            const chromedriverLogPath = path.join(testsuiteRootPath, "chromedriver.log");
            opts.chromeDriverLogPath = chromedriverLogPath;

            // Collect webdriver logs
            const webdriverLogsPath = path.join(testsuiteRootPath, "webdriver");
            mkdirp.sync(webdriverLogsPath);
            opts.webdriverLogPath = webdriverLogsPath;
        }

        this.spectron = new Application(opts);
        console.log(`Starting VS Code with options:\n${JSON.stringify(opts, null, 2)}`);
        await this.spectron.start();

        if (testsuiteRootPath) {
            // Collect logs
            const mainProcessLogPath = path.join(testsuiteRootPath, "main.log");
            const rendererProcessLogPath = path.join(testsuiteRootPath, "renderer.log");

            const flush = async () => {
                if (!this.spectron) {
                    return;
                }

                const mainLogs = await this.spectron.client.getMainProcessLogs();
                await new Promise((c, e) => fs.appendFile(mainProcessLogPath, mainLogs.join("\n"), { encoding: "utf8" }, err => err ? e(err) : c()));

                const rendererLogs = (await this.spectron.client.getRenderProcessLogs()).map(m => `${m.timestamp} - ${m.level} - ${m.message}`);
                await new Promise((c, e) => fs.appendFile(rendererProcessLogPath, rendererLogs.join("\n"), { encoding: "utf8" }, err => err ? e(err) : c()));
            };

            let running = true;
            const loopFlush = async () => {
                while (true) {
                    await flush();

                    if (!running) {
                        return;
                    }

                    await new Promise(c => setTimeout(c, 1000));
                }
            };

            const loopPromise = loopFlush();
            this.stopLogCollection = () => {
                running = false;
                return loopPromise;
            };
        }

        this._screenCapturer = new ScreenCapturer(this.spectron, this._suiteName, screenshotsDirPath);
        this._client = new SpectronClient(this.spectron, this, this.options.waitTime);
        this._workbench = new Workbench(this);
    }

    private async checkWindowReady(): Promise<any> {
        await this.webclient.waitUntilWindowLoaded();

        // Pick the first workbench window here
        const count = await this.webclient.getWindowCount();

        for (let i = 0; i < count; i++) {
            await this.webclient.windowByIndex(i);

            if (/bootstrap\/index\.html/.test(await this.webclient.getUrl())) {
                break;
            }
        }

        await this.client.waitForElement(".monaco-workbench");
    }

    private async waitForWelcome(): Promise<any> {
        await this.client.waitForElement(".explorer-folders-view");
        await this.client.waitForElement(`.editor-instance[id="workbench.editor.walkThroughPart"] .welcomePage`);
    }

    private retrieveKeybindings(): Promise<void> {
        return new Promise((c, e) => {
            fs.readFile(process.env.VSCODE_KEYBINDINGS_PATH as string, "utf8", (err, data) => {
                if (err) {
                    throw err;
                }
                try {
                    this.keybindings = JSON.parse(data);
                    c();
                } catch (e) {
                    throw new Error(`Error parsing keybindings JSON: ${e}`);
                }
            });
        });
    }

    /**
     * Transliterates key names from keybindings file to WebdriverIO keyboard actions defined in:
     * https://w3c.github.io/webdriver/webdriver-spec.html#keyboard-actions
     */
    private transliterate(key: string): string {
        // This list includes only special cases that are not parsed properly by webdriverio@4.14
        // For example "Up" entry is would be parsed to the sequence "u", "p" but it's actually a "ArrowUp"
        // If Spectron changes major version of webdriverio it depends on then this list should be revisited and changed accordingly if needed!
        // Full list of constants that webdriverio@4.14 uses:
        // https://github.com/webdriverio/webdriverio/blob/6866934436a32d99aa5123d1f6e983e3d696f2aa/lib/helpers/constants.js#L147
        const VsCodeToWebDriverSpecialCharsMap = {
            "ctrl" : "Control",
            "cmd" : "Meta",
            "left" : "ArrowLeft",
            "up" : "ArrowUp",
            "right" : "ArrowRight",
            "down" : "ArrowDown",
            ";" : "Semicolon",
            "," : "Separator",
            "=" : "Equals",
            "numpad0" : "Numpad 0",
            "numpad1" : "Numpad 1",
            "numpad2" : "Numpad 2",
            "numpad3" : "Numpad 3",
            "numpad4" : "Numpad 4",
            "numpad5" : "Numpad 5",
            "numpad6" : "Numpad 6",
            "numpad7" : "Numpad 7",
            "numpad8" : "Numpad 8",
            "numpad9" : "Numpad 9",
            "*" : "Multiply",
            "+" : "Add",
            "-" : "Subtract",
            "." : "Decimal",
            "/" : "Divide",
        };

        if (VsCodeToWebDriverSpecialCharsMap[key]) {
            return VsCodeToWebDriverSpecialCharsMap[key];
        } else {
            return key.length === 1 ? key : key.charAt(0).toUpperCase() + key.slice(1);
        }
    }
}
