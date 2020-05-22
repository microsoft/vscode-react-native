// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.

import * as path from "path";
import * as cp from "child_process";
import * as os from "os";
import * as fs from "fs";
import * as mkdirp from "mkdirp";
import { tmpNameSync } from "tmp";
import { IDriver, connect as connectElectronDriver, IDisposable, IElement, Thenable } from "./driver";
import { connect as connectPlaywrightDriver, launch } from './playwrightDriver';
import { Logger } from "./logger";
import { ncp } from "ncp";
import { URI } from "vscode-uri";

const repoPath = path.join(__dirname, "../../..");

function getDevElectronPath(): string {
    const buildPath = path.join(repoPath, ".build");
    const product = require(path.join(repoPath, "product.json"));

    switch (process.platform) {
        case "darwin":
            return path.join(buildPath, "electron", `${product.nameLong}.app`, "Contents", "MacOS", "Electron");
        case "linux":
            return path.join(buildPath, "electron", `${product.applicationName}`);
        case "win32":
            return path.join(buildPath, "electron", `${product.nameShort}.exe`);
        default:
            throw new Error("Unsupported platform.");
    }
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

function getDevOutPath(): string {
    return path.join(repoPath, "out");
}

function getBuildOutPath(root: string): string {
    switch (process.platform) {
        case "darwin":
            return path.join(root, "Contents", "Resources", "app", "out");
        default:
            return path.join(root, "resources", "app", "out");
    }
}

async function connect(connectDriver: typeof connectElectronDriver, child: cp.ChildProcess | undefined, outPath: string, handlePath: string, logger: Logger): Promise<Code> {
    let errCount = 0;

    while (true) {
        try {
            const { client, driver } = await connectDriver(outPath, handlePath);
            return new Code(client, driver, logger);
        } catch (err) {
            if (++errCount > 50) {
                if (child) {
                    child.kill();
                }
                throw err;
            }

            // retry
            await new Promise(c => setTimeout(c, 100));
        }
    }
}

// Kill all running instances, when dead
const instances = new Set<cp.ChildProcess>();
process.once("exit", () => instances.forEach(code => code.kill()));

export interface SpawnOptions {
    codePath?: string;
    workspacePath: string;
    userDataDir: string;
    extensionsPath: string;
    logger: Logger;
    verbose?: boolean;
    extraArgs?: string[];
    log?: string;
    /** Run in the test resolver */
    remote?: boolean;
    /** Run in the web */
    web?: boolean;
    /** A specific browser to use (requires web: true) */
    browser?: "chromium" | "webkit" | "firefox";
    /** Run in headless mode (only applies when web is true) */
    headless?: boolean;
}

function createDriverHandle(): string {
    if ("win32" === os.platform()) {
        const name = [...Array(15)].map(() => Math.random().toString(36)[3]).join("");
        return `\\\\.\\pipe\\${name}`;
    } else {
        return tmpNameSync();
    }
}

export async function spawn(options: SpawnOptions): Promise<Code> {
    const codePath = options.codePath;
    const electronPath = codePath ? getBuildElectronPath(codePath) : getDevElectronPath();
    const outPath = codePath ? getBuildOutPath(codePath) : getDevOutPath();
    const handle = createDriverHandle();

    const args = [
        options.workspacePath,
        "--skip-getting-started",
        "--skip-release-notes",
        "--sticky-quickopen",
        "--disable-telemetry",
        "--disable-updates",
        "--disable-crash-reporter",
        `--extensions-dir=${options.extensionsPath}`,
        `--user-data-dir=${options.userDataDir}`,
        `--disable-restore-windows`,
        "--driver", handle,
    ];

    const env = process.env;

    if (options.remote) {
        // Replace workspace path with URI
        args[0] = `--${options.workspacePath.endsWith(".code-workspace") ? "file" : "folder"}-uri=vscode-remote://test+test/${URI.file(options.workspacePath).path}`;

        if (codePath) {
            // running against a build: copy the test resolver extension
            const testResolverExtPath = path.join(options.extensionsPath, "vscode-test-resolver");
            if (!fs.existsSync(testResolverExtPath)) {
                const orig = path.join(repoPath, "extensions", "vscode-test-resolver");
                await new Promise((c, e) => ncp(orig, testResolverExtPath, err => err ? e(err) : c()));
            }
        }
        args.push("--enable-proposed-api=vscode.vscode-test-resolver");
        const remoteDataDir = `${options.userDataDir}-server`;
        mkdirp.sync(remoteDataDir);
        env["TESTRESOLVER_DATA_FOLDER"] = remoteDataDir;
    }

    if (!codePath) {
        args.unshift(repoPath);
    }

    if (options.verbose) {
        args.push("--driver-verbose");
    }

    if (options.log) {
        args.push("--log", options.log);
    }

    if (options.extraArgs) {
        args.push(...options.extraArgs);
    }

    let child: cp.ChildProcess | undefined;
    let connectDriver: typeof connectElectronDriver;

    if (options.web) {
        await launch(options.userDataDir, options.workspacePath, options.codePath);
        connectDriver = connectPlaywrightDriver.bind(connectPlaywrightDriver, options.browser);
        return connect(connectDriver, child, "", handle, options.logger);
    } else {
        const spawnOptions: cp.SpawnOptions = { env };
        child = cp.spawn(electronPath, args, spawnOptions);
        instances.add(child);
        child.once("exit", () => instances.delete(child!));
        connectDriver = connectElectronDriver;
    }
    return connect(connectDriver, child, outPath, handle, options.logger);
}

async function poll<T>(
    fn: () => Thenable<T>,
    acceptFn: (result: T) => boolean,
    timeoutMessage: string,
    retryCount: number = 2000,
    retryInterval: number = 100 // millis
): Promise<T> {
    let trial = 1;
    let lastError: string = "";

    while (true) {
        if (trial > retryCount) {
            console.error("** Timeout!");
            console.error(lastError);

            throw new Error(`Timeout: ${timeoutMessage} after ${(retryCount * retryInterval) / 1000} seconds.`);
        }

        let result;
        try {
            result = await fn();

            if (acceptFn(result)) {
                return result;
            } else {
                lastError = "Did not pass accept function";
            }
        } catch (e) {
            lastError = Array.isArray(e.stack) ? e.stack.join(os.EOL) : e.stack;
        }

        await new Promise(resolve => setTimeout(resolve, retryInterval));
        trial++;
    }
}

export class Code {

    private _activeWindowId: number | undefined = undefined;
    private driver: IDriver;

    constructor(
        private client: IDisposable,
        driver: IDriver,
        readonly logger: Logger
    ) {
        this.driver = new Proxy(driver, {
            get(target, prop, receiver) {
                if (typeof prop === "symbol") {
                    throw new Error("Invalid usage");
                }

                const targetProp = (target as any)[prop];
                if (typeof targetProp !== "function") {
                    return targetProp;
                }

                return function (this: any, ...args: any[]) {
                    logger.log(`${prop}`, ...args.filter(a => typeof a === "string"));
                    return targetProp.apply(this, args);
                };
            },
        });
    }

    public async capturePage(): Promise<string> {
        const windowId = await this.getActiveWindowId();
        return await this.driver.capturePage(windowId);
    }

    public async waitForWindowIds(fn: (windowIds: number[]) => boolean): Promise<void> {
        await poll(() => this.driver.getWindowIds(), fn, `get window ids`);
    }

    public async dispatchKeybinding(keybinding: string): Promise<void> {
        const windowId = await this.getActiveWindowId();
        await this.driver.dispatchKeybinding(windowId, keybinding);
    }

    public async reload(): Promise<void> {
        const windowId = await this.getActiveWindowId();
        await this.driver.reloadWindow(windowId);
    }

    public async exit(): Promise<void> {
        await this.driver.exitApplication();
    }

    public async waitForTextContent(selector: string, textContent?: string, accept?: (result: string) => boolean): Promise<string> {
        const windowId = await this.getActiveWindowId();
        accept = accept || (result => textContent !== undefined ? textContent === result : !!result);

        return await poll(
            () => this.driver.getElements(windowId, selector).then(els => els.length > 0 ? Promise.resolve(els[0].textContent) : Promise.reject(new Error("Element not found for textContent"))),
            s => accept!(typeof s === "string" ? s : ""),
            `get text content '${selector}'`
        );
    }

    public async waitAndClick(selector: string, xoffset?: number, yoffset?: number): Promise<void> {
        const windowId = await this.getActiveWindowId();
        await poll(() => this.driver.click(windowId, selector, xoffset, yoffset), () => true, `click '${selector}'`);
    }

    public async waitAndDoubleClick(selector: string): Promise<void> {
        const windowId = await this.getActiveWindowId();
        await poll(() => this.driver.doubleClick(windowId, selector), () => true, `double click '${selector}'`);
    }

    public async waitForSetValue(selector: string, value: string): Promise<void> {
        const windowId = await this.getActiveWindowId();
        await poll(() => this.driver.setValue(windowId, selector, value), () => true, `set value '${selector}'`);
    }

    public async waitForElements(selector: string, recursive: boolean, accept: (result: IElement[]) => boolean = result => result.length > 0): Promise<IElement[]> {
        const windowId = await this.getActiveWindowId();
        return await poll(() => this.driver.getElements(windowId, selector, recursive), accept, `get elements '${selector}'`);
    }

    public async waitForElement(selector: string, accept: (result: IElement | undefined) => boolean = result => !!result, retryCount: number = 2000): Promise<IElement> {
        const windowId = await this.getActiveWindowId();
        return await poll<IElement>(() => this.driver.getElements(windowId, selector).then(els => els[0]), accept, `get element '${selector}'`, retryCount);
    }

    public async waitForActiveElement(selector: string, retryCount: number = 2000): Promise<void> {
        const windowId = await this.getActiveWindowId();
        await poll(() => this.driver.isActiveElement(windowId, selector), r => r, `is active element '${selector}'`, retryCount);
    }

    public async waitForTitle(fn: (title: string) => boolean): Promise<void> {
        const windowId = await this.getActiveWindowId();
        await poll(() => this.driver.getTitle(windowId), fn, `get title`);
    }

    public async waitForTypeInEditor(selector: string, text: string): Promise<void> {
        const windowId = await this.getActiveWindowId();
        await poll(() => this.driver.typeInEditor(windowId, selector, text), () => true, `type in editor '${selector}'`);
    }

    public async waitForTerminalBuffer(selector: string, accept: (result: string[]) => boolean): Promise<void> {
        const windowId = await this.getActiveWindowId();
        await poll(() => this.driver.getTerminalBuffer(windowId, selector), accept, `get terminal buffer '${selector}'`);
    }

    public async writeInTerminal(selector: string, value: string): Promise<void> {
        const windowId = await this.getActiveWindowId();
        await poll(() => this.driver.writeInTerminal(windowId, selector, value), () => true, `writeInTerminal '${selector}'`);
    }

    public dispose(): void {
        this.client.dispose();
    }

    private async getActiveWindowId(): Promise<number> {
        if (typeof this._activeWindowId !== "number") {
            const windows = await this.driver.getWindowIds();
            this._activeWindowId = windows[0];
        }

        return this._activeWindowId;
    }
}

export function findElement(element: IElement, fn: (element: IElement) => boolean): IElement | null {
    const queue = [element];

    while (queue.length > 0) {
        const element = queue.shift()!;

        if (fn(element)) {
            return element;
        }

        queue.push(...element.children);
    }

    return null;
}

export function findElements(element: IElement, fn: (element: IElement) => boolean): IElement[] {
    const result: IElement[] = [];
    const queue = [element];

    while (queue.length > 0) {
        const element = queue.shift()!;

        if (fn(element)) {
            result.push(element);
        }

        queue.push(...element.children);
    }

    return result;
}
