// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.

import * as fs from "fs";
import * as path from "path";
import * as child_process from "child_process";
import * as execa from "execa";
// import * as vscode from "vscode";
// import * as io from "socket.io-client";
import * as nls from "vscode-nls";
import * as browserHelper from "vscode-js-debug-browsers";
import { EventEmitter } from "vscode";
// import { ErrorHelper } from "../../common/error/errorHelper";
// import { InternalErrorCode } from "../../common/error/internalErrorCode";
import { BrowserTargetType, GeneralPlatform } from "../generalPlatform";
import { IBrowserOptions, PlatformType } from "../launchArgs";

nls.config({
    messageFormat: nls.MessageFormat.bundle,
    bundleFormat: nls.BundleFormat.standalone,
})();

const localize = nls.loadMessageBundle();

export default class BrowserPlatform extends GeneralPlatform {
    public static readonly CHROME_DATA_DIR = "chrome_sandbox_dir"; // The directory to use for the sandboxed Chrome instance that gets launched to debug the app

    private browserProc: child_process.ChildProcess | null;

    private browserStopEventEmitter: EventEmitter<Error | undefined> = new EventEmitter();
    public readonly onBrowserStop = this.browserStopEventEmitter.event;

    constructor(protected platformOpts: IBrowserOptions) {
        super(platformOpts);
    }

    public getPlatformOpts(): IBrowserOptions {
        return this.platformOpts;
    }

    public async launchApp(): Promise<void> {
        this.runArguments = this.getRunArguments();

        // Launch browser
        let browserFinder: browserHelper.IBrowserFinder;
        if (this.platformOpts.platform == PlatformType.ExpoWeb) {
            switch (this.platformOpts.browserTarget) {
                case BrowserTargetType.Edge:
                    browserFinder = new browserHelper.EdgeBrowserFinder(
                        process.env,
                        fs.promises,
                        execa,
                    );
                    break;
                case BrowserTargetType.Chrome:
                default:
                    browserFinder = new browserHelper.ChromeBrowserFinder(
                        process.env,
                        fs.promises,
                        execa,
                    );
            }
            const browserPath = (await browserFinder.findAll())[0];
            if (browserPath) {
                this.browserProc = child_process.spawn(browserPath.path, this.runArguments, {
                    detached: true,
                    stdio: ["ignore"],
                });
                this.browserProc.unref();
                this.browserProc.on("error", err => {
                    const errMsg = localize("BrowserError", "Browser error: {0}", err.message);
                    this.logger.error(errMsg);
                    this.browserStopEventEmitter.fire(err);
                });
                this.browserProc.once("exit", (code: number) => {
                    const exitMessage = localize(
                        "BrowserExit",
                        "Browser has been closed with exit code: {0}",
                        code,
                    );
                    this.logger.info(exitMessage);
                    this.browserStopEventEmitter.fire(undefined);
                });
            }
        }
    }

    public async prepareForAttach(): Promise<void> {}

    public async stopAndCleanUp(): Promise<void> {
        if (this.browserProc) {
            this.browserProc.kill("SIGINT");
            if (this.platformOpts.browserTarget === BrowserTargetType.Chrome) {
                this.setChromeExitTypeNormal();
            }
            this.browserProc = null;
        }
    }

    public getRunArguments(): string[] {
        const args: string[] = [
            `--remote-debugging-port=${this.platformOpts.port || 9222}`,
            "--no-first-run",
            "--no-default-browser-check",
            `--user-data-dir=${this.platformOpts.userDataDir}`,
        ];
        if (this.platformOpts.runArguments) {
            const runArguments = [...this.platformOpts.runArguments];
            const remoteDebuggingPort = BrowserPlatform.getOptFromRunArgs(
                runArguments,
                "--remote-debugging-port",
            );
            const noFirstRun = BrowserPlatform.getOptFromRunArgs(
                runArguments,
                "--no-first-run",
                true,
            );
            const noDefaultBrowserCheck = BrowserPlatform.getOptFromRunArgs(
                runArguments,
                "--no-default-browser-check",
                true,
            );
            const userDataDir = BrowserPlatform.getOptFromRunArgs(runArguments, "--user-data-dir");

            if (noFirstRun) {
                BrowserPlatform.removeRunArgument(runArguments, "--no-first-run", true);
            }
            if (noDefaultBrowserCheck) {
                BrowserPlatform.removeRunArgument(runArguments, "--no-default-browser-check", true);
            }
            if (remoteDebuggingPort) {
                BrowserPlatform.setRunArgument(
                    args,
                    "--remote-debugging-port",
                    remoteDebuggingPort,
                );
                BrowserPlatform.removeRunArgument(runArguments, "--remote-debugging-port", false);
            }
            if (userDataDir) {
                BrowserPlatform.setRunArgument(args, "--user-data-dir", userDataDir);
                BrowserPlatform.removeRunArgument(runArguments, "--user-data-dir", false);
            }

            args.push(...runArguments);
        }
        if (this.platformOpts.url) {
            args.push(this.platformOpts.url);
        }
        return args;
    }

    private setChromeExitTypeNormal() {
        try {
            const preferencesPath = path.resolve(
                this.platformOpts.userDataDir,
                "Default",
                "Preferences",
            );
            const browserPrefs = JSON.parse(fs.readFileSync(preferencesPath, "utf8"));
            console.log(browserPrefs);
            browserPrefs.profile.exit_type = "normal";
            fs.writeFileSync(preferencesPath, JSON.stringify(browserPrefs));
        } catch {
            // Just ignore possible errors
        }
    }
}
