// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.

import * as path from "path";
import * as utilities from "./utilities";
import * as rimraf from "rimraf";
import * as cp from "child_process";
import * as vscodeTest from "vscode-test";

import { spawnSync } from "./utilities";

export class VSCodeHelper {
    private static version;
    private static downloadPlatform = (process.platform === "darwin") ? "darwin" : process.platform === "win32" ? "win32-x64-archive" : "linux-x64";
    private static artifactsFolderName = "drop-win";

    public static async downloadVSCodeExecutable(): Promise<string> {
        VSCodeHelper.version = process.env.CODE_VERSION || "*";

        return vscodeTest.downloadAndUnzipVSCode(VSCodeHelper.version, VSCodeHelper.downloadPlatform);
    }

    public static installExtensionFromVSIX(extensionDir: string, testVSCodeExecutablePath: string, resourcesPath: string, deleteVSIX: boolean): void {
        let args: string[] = [];
        args.push(`--extensions-dir=${extensionDir}`);
        const artifactPath = path.join(resourcesPath, VSCodeHelper.artifactsFolderName);
        let extensionFile = utilities.findFile(artifactPath, /.*\.(vsix)/);
        if (!extensionFile) {
            throw new Error(`React Native extension .vsix is not found in ${resourcesPath}`);
        }

        extensionFile = path.join(artifactPath, extensionFile);
        args.push(`--install-extension=${extensionFile}`);
        console.log(`*** Installing extension to VS Code using command: ${testVSCodeExecutablePath} ${args.join(" ")}`);
        spawnSync(testVSCodeExecutablePath, args, { stdio: "inherit" });

        if (deleteVSIX) {
            console.log(`*** Deleting ${extensionFile} after installation`);
            rimraf.sync(extensionFile);
        } else {
            console.log("*** --dont-delete-vsix parameter is set, skipping deleting of VSIX");
        }
    }

    public static getVSCodeExecutablePath(testVSCodeFolder: string): string {
        return vscodeTest.resolveCliPathFromVSCodeExecutablePath(testVSCodeFolder);
    }

    public static killWinCodeProcesses(taskKillCommands: string[]): void {
        if (process.platform !== "win32") {
            return;
        }
        try {
            console.log("*** Killing any running Code.exe instances");
            taskKillCommands.forEach(cmd => {
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

    /**
     * Commands to kill all VS Code instances
     * @param testVSCodeFolder
     * @param isInsiders
     */
    public static getTaskKillCommands(testVSCodeFolder: string, isInsiders: boolean, userName: string): string[] {
        if (process.platform !== "win32") {
            return [];
        }

        let commands: string[] = [];
        // conhost.exe with path\to\Code.exe
        const exeName = isInsiders ? "Code - Insiders.exe" : "Code.exe";
        const codeExePath = path.join(testVSCodeFolder, exeName);
        commands.push(`taskkill /f /t /fi "WINDOWTITLE eq ${codeExePath}" /fi "USERNAME eq ${userName}"`);
        // Code.exe (or Code - Insiders.exe) windows
        commands.push(`taskkill /f /t /fi "IMAGENAME eq ${exeName}" /fi "USERNAME eq ${userName}`);
        // CodeHelper.exe window
        commands.push(`taskkill /f /t /fi "IMAGENAME eq CodeHelper.exe" /fi "USERNAME eq ${userName}`);
        return commands;
    }
}
