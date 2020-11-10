// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.
import * as fs from "fs";
import * as path from "path";
import * as cp from "child_process";
import * as utilities from "./utilities";
import * as vscodeTest from "vscode-test";
import * as rimraf from "rimraf";
import { Application, Quality, ApplicationOptions, MultiLogger, Logger, ConsoleLogger } from "../../../automation";
import { SmokeTestsConstants } from "./smokeTestsConstants";

export class VsCodeManager {
    private cacheDirectory: string;

    private vsCodeClientDirectory: string;
    private resourcesDirectory: string;
    private extensionDirectory: string;
    private vsCodeClientAppFileDirectory: string;
    private vsCodeClientCmdDirectory: string;
    private vsixDirectory: string;
    private vsCodeUserDataDirectory: string;
    private artifactDirectory: string;
    private currentSessionLogsDir?: string;

    private clientIsInstalled: boolean = false;
    private clientVersion: string;
    private taskKillCommands: string[] = [];
    private downloadPlatform = (process.platform === "darwin") ? "darwin" : process.platform === "win32" ? "win32-x64-archive" : "linux-x64";

    private static VS_CODE_CLIENT_NOT_INSTALLED_ERROR = "VS Code client was not installed";
    private static CURRENT_SESSION_LOGS_DIR_ERROR = "Сurrent session logs directory is not defined";

    constructor(vscodeTestDirectory: string, resourcesDirectory: string, cacheDirectory: string) {
        this.cacheDirectory = cacheDirectory;
        this.resourcesDirectory = resourcesDirectory;
        this.vsCodeUserDataDirectory = path.join(cacheDirectory, SmokeTestsConstants.VSCodeUserDataDir);
        this.artifactDirectory = path.join(cacheDirectory, SmokeTestsConstants.artifactsDir);
        this.clientVersion = process.env.CODE_VERSION ? process.env.CODE_VERSION : "stable";
        this.vsCodeClientDirectory = path.resolve(vscodeTestDirectory, `vscode-${this.clientVersion}`);
        this.extensionDirectory = path.resolve(this.vsCodeClientDirectory, "extension");
        this.vsixDirectory = path.join(this.resourcesDirectory, "drop-win");

        this.vsCodeClientAppFileDirectory = this.downloadDirToExecutablePath();
        this.vsCodeClientCmdDirectory = vscodeTest.resolveCliPathFromVSCodeExecutablePath(this.vsCodeClientAppFileDirectory);

        if (this.checkIfRequarePathsExists()) {
            this.clientIsInstalled = true;
        }
    }

    public getArtifactDirectory() : string {
        return this.artifactDirectory;
    }

    public async downloadVSCodeExecutable(): Promise<any> {
        console.log("*** Downloading VS Code executable...");

        if (!fs.existsSync(this.cacheDirectory)) {
            console.log(`*** Creating smoke tests cache directory: ${this.cacheDirectory}`);
            fs.mkdirSync(this.cacheDirectory);
        }
        if (!fs.existsSync(this.vsCodeUserDataDirectory)) {
            console.log(`*** Creating VS Code user data directory: ${this.vsCodeUserDataDirectory}`);
            fs.mkdirSync(this.vsCodeUserDataDirectory);
        }
        if (!fs.existsSync(this.artifactDirectory)) {
            console.log(`*** Creating artifact directory: ${this.artifactDirectory}`);
            fs.mkdirSync(this.artifactDirectory);
        }

        this.vsCodeClientAppFileDirectory = await vscodeTest.downloadAndUnzipVSCode(this.clientVersion, this.downloadPlatform);
        this.vsCodeClientCmdDirectory = vscodeTest.resolveCliPathFromVSCodeExecutablePath(this.vsCodeClientAppFileDirectory);
        this.clientIsInstalled = true;
        this.taskKillCommands = this.collectTaskKillCommands();
    }

    public cleanUp(): void {
        console.log("\n*** Clean up...");
        if (fs.existsSync(this.vsCodeClientDirectory)) {
            console.log(`*** Deleting test VS Code directory: ${this.vsCodeClientDirectory}`);
            rimraf.sync(this.vsCodeClientDirectory);
        }
        if (fs.existsSync(this.vsCodeUserDataDirectory)) {
            console.log(`*** Deleting VS Code temporary user data dir: ${this.vsCodeUserDataDirectory}`);
            rimraf.sync(this.vsCodeUserDataDirectory);
        }
        if (fs.existsSync(this.artifactDirectory)) {
            console.log(`*** Deleting test logs directory: ${this.artifactDirectory}`);
            rimraf.sync(this.artifactDirectory);
        }

        this.clientIsInstalled = false;
    }

    public installExtensionFromVSIX(deleteVSIX: boolean = false): void {
        if (this.clientIsInstalled) {
            let args: string[] = [];
            args.push(`--extensions-dir=${this.extensionDirectory}`);
            let extensionFile = utilities.findFile(this.vsixDirectory, /.*\.(vsix)/);
            if (!extensionFile) {
                throw new Error(`React Native extension .vsix is not found in ${this.resourcesDirectory}`);
            }

            extensionFile = path.join(this.vsixDirectory, extensionFile);
            args.push(`--install-extension=${extensionFile}`);
            console.log(`*** Installing extension to VS Code using command: ${this.vsCodeClientCmdDirectory} ${args.join(" ")}`);
            utilities.spawnSync(this.vsCodeClientCmdDirectory, args, {stdio: "inherit"});

            if (deleteVSIX) {
                console.log(`*** Deleting ${extensionFile} after installation`);
                rimraf.sync(extensionFile);
            } else {
                console.log("*** --dont-delete-vsix parameter is set, skipping deleting of VSIX");
            }
        }
        else {
            throw new Error(VsCodeManager.VS_CODE_CLIENT_NOT_INSTALLED_ERROR);
        }
    }

    public installExpoXdlPackageToExtensionDir(): void {
        if (this.clientIsInstalled) {
            if (process.env.EXPO_XDL_VERSION) {
                const extensionDirName = utilities.findFile(this.extensionDirectory, /msjsdiag\.vscode-react-native.*/);
                if (!extensionDirName) {
                    throw new Error("Couldn't find extension directory");
                }
                const extensionFullPath = path.join(this.extensionDirectory, extensionDirName);

                let npmCmd = "npm";
                if (process.platform === "win32") {
                    npmCmd = "npm.cmd";
                }
                const command = `${npmCmd} install @expo/xdl@${process.env.EXPO_XDL_VERSION} --no-save`;

                console.log(`*** Adding @expo/xdl dependency to ${extensionFullPath} via '${command}' command...`);
                cp.execSync(command, { cwd: extensionFullPath, stdio: "inherit" });
            }
            else {
                console.log(`*** EXPO_XDL_VERSION variable is not set, skipping installation of @expo/xdl package to the extension directory`);
            }
        }
        else {
            throw new Error(VsCodeManager.VS_CODE_CLIENT_NOT_INSTALLED_ERROR);
        }
    }

    public killWinCodeProcesses(): void {
        if (process.platform !== "win32") {
            return;
        }
        try {
            console.log("*** Killing any running Code.exe instances");
            this.taskKillCommands.forEach(cmd => {
                console.log(`*** Running ${cmd}`);
                const result = cp.execSync(cmd);
                console.log(result.toString());
            });
        } catch (e) {
            // Do not throw error, just print it to avoid any build failures
            // Sometimes taskkill process throws error but tasks are already killed so error is pointless
            console.error(e);
        }
    }

    public async runVSCode(workspaceOrFolder: string, sessionName?: string, locale?: string): Promise<Application> {
        if (this.clientIsInstalled) {
            if (!sessionName) {
                sessionName = "UnknownTest";
            }
            const dirName = `${sessionName}-[${new Date().toLocaleString(locale)}]`;
            if (this.artifactDirectory) {
                const extensionLogsDir = path.join(this.artifactDirectory, dirName, "extensionLogs");
                process.env.REACT_NATIVE_TOOLS_LOGS_DIR = extensionLogsDir;
                this.currentSessionLogsDir = extensionLogsDir;
            }
            let quality: Quality;
            if (this.clientVersion === "insiders") {
                quality = Quality.Insiders;
            } else {
                quality = Quality.Stable;
            }
            const options = this.createOptions(quality, workspaceOrFolder, dirName, locale ? ["--locale", locale] : []);
            const app = new Application(options);
            console.log(`Options for run ${dirName}: ${JSON.stringify(options, null, 2)}`);
            await app.start();
            return app;

        }
        else {
            throw new Error(VsCodeManager.VS_CODE_CLIENT_NOT_INSTALLED_ERROR);
        }
    }

    private createOptions(quality: Quality, workspaceOrFolder: string, dataDirFolderName: string, extraArgs?: string[]): ApplicationOptions {
        if (this.clientIsInstalled) {
            let logsDir = "";
            if (this.currentSessionLogsDir) {
                logsDir = this.currentSessionLogsDir;
            }
            else {
                throw new Error(VsCodeManager.CURRENT_SESSION_LOGS_DIR_ERROR);
            }
            const loggers: Logger[] = [];

            loggers.push(new ConsoleLogger());

            console.log(`*** Executing ${this.vsCodeClientAppFileDirectory}`);

            return {
                quality,
                codePath: this.vsCodeClientDirectory,
                workspacePath: workspaceOrFolder,
                userDataDir: path.join(this.vsCodeUserDataDirectory, dataDirFolderName),
                extensionsPath: this.extensionDirectory,
                waitTime: SmokeTestsConstants.elementResponseTimeout,
                logger: new MultiLogger(loggers),
                verbose: true,
                screenshotsPath: path.join(logsDir, "screenshots"),
                extraArgs: extraArgs,
            };
        } else {
            throw new Error(VsCodeManager.VS_CODE_CLIENT_NOT_INSTALLED_ERROR);
        }
    }

    private collectTaskKillCommands(): string[] {
        if (process.platform !== "win32") {
            return [];
        }

        if (this.clientIsInstalled) {
            let commands: string[] = [];

            const userName = cp.execSync("whoami").toString().trim();

            commands.push(`taskkill /f /t /fi "WINDOWTITLE eq ${this.vsCodeClientAppFileDirectory}" /fi "USERNAME eq ${userName}"`);
            // Code.exe (or Code - Insiders.exe) windows
            commands.push(`taskkill /f /t /fi "IMAGENAME eq ${this.vsCodeClientAppFileDirectory}" /fi "USERNAME eq ${userName}`);
            // CodeHelper.exe window
            commands.push(`taskkill /f /t /fi "IMAGENAME eq CodeHelper.exe" /fi "USERNAME eq ${userName}`);
            return commands;
        }
        else {
            throw new Error(VsCodeManager.VS_CODE_CLIENT_NOT_INSTALLED_ERROR);
        }
    }

    private downloadDirToExecutablePath() {
        const isInsiders = this.clientVersion === "insiders";

        switch (process.platform) {
            case "darwin":
                return isInsiders
                    ?
                    path.resolve(this.vsCodeClientDirectory, 'Visual Studio Code - Insiders.app/Contents/MacOS/Electron')
                    :
                    path.resolve(this.vsCodeClientDirectory, 'Visual Studio Code.app/Contents/MacOS/Electron');
            case "win32":
                return isInsiders
                    ?
                    path.resolve(this.vsCodeClientDirectory, 'Code - Insiders.exe')
                    :
                    path.resolve(this.vsCodeClientDirectory, 'Code.exe');
            case "linux":
                return isInsiders
                    ?
                    path.resolve(this.vsCodeClientDirectory, 'VSCode-linux-x64/code-insiders')
                    :
                    path.resolve(this.vsCodeClientDirectory, 'VSCode-linux-x64/code');
            default:
                throw new Error(`Platform ${process.platform} isn't supported`);
        }
    }

    public findStringInLogs(string: string, logFile: string): boolean {
        if (this.currentSessionLogsDir) {
            console.log(`*** Searching for \"Test output from Hermes debuggee\" string in output file`);
            return utilities.findStringInFile(path.join(this.currentSessionLogsDir, logFile), string);
        }
        else {
            throw new Error(VsCodeManager.CURRENT_SESSION_LOGS_DIR_ERROR);
        }
    }

    public findPatternInLogs(reg: RegExp, logFile: string): string[] | null {
        if (this.currentSessionLogsDir) {
            let content = fs.readFileSync(path.join(this.currentSessionLogsDir, logFile)).toString().trim();
            const match = content.match(reg);
            if (!match) return null;
            return match;
        }
        else {
            throw new Error(VsCodeManager.CURRENT_SESSION_LOGS_DIR_ERROR);
        }
    }

    private checkIfRequarePathsExists(): boolean {
        return fs.existsSync(this.vsCodeClientDirectory) &&
        fs.existsSync(this.vsCodeClientAppFileDirectory) &&
        fs.existsSync(this.vsCodeClientCmdDirectory) &&
        fs.existsSync(this.vsCodeUserDataDirectory) &&
        fs.existsSync(this.artifactDirectory);
    }
}