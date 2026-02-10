// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.

import * as assert from "assert";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import * as url from "url";
import * as vscode from "vscode";
import { ErrorHelper } from "../../common/error/errorHelper";
import { InternalErrorCode } from "../../common/error/internalErrorCode";
import { ChildProcess } from "../../common/node/childProcess";
import { OutputChannelLogger } from "../log/OutputChannelLogger";
import { Command } from "./util/command";

const logger = OutputChannelLogger.getMainChannel();
const childProcess = new ChildProcess();

export class InstallPods extends Command {
    codeName = "installPods";
    label = "Install CocoaPods dependencies";
    error = ErrorHelper.getInternalError(InternalErrorCode.FailedToInstallPods);
    requiresTrust = true;

    async baseFn(): Promise<void> {
        assert(this.project);
        if (os.platform() !== "darwin") {
            void vscode.window.showWarningMessage("CocoaPods is only supported on macOS.");
            return;
        }
        const projectPath = this.project.getPackager().getProjectPath();
        const iosPath = path.join(projectPath, "ios");
        if (!fs.existsSync(iosPath)) {
            const errorMsg =
                "iOS directory not found. Make sure this is a React Native project with iOS support.";
            logger.error(errorMsg);
            void vscode.window.showErrorMessage(errorMsg);
            return;
        }
        const podfilePath = path.join(iosPath, "Podfile");
        if (!fs.existsSync(podfilePath)) {
            const errorMsg = "Podfile not found in the ios directory.";
            logger.error(errorMsg);
            void vscode.window.showErrorMessage(errorMsg);
            return;
        }
        logger.info("Installing CocoaPods dependencies...");
        logger.info(`Working directory: ${iosPath}`);
        try {
            const enhancedEnv = this.getEnhancedEnvironment();
            const podCommand = this.findPodCommand();
            logger.info(`Using pod command: ${podCommand}`);
            try {
                const versionResult = await childProcess.exec(`${podCommand} --version`, {
                    env: enhancedEnv,
                    timeout: 10000,
                });
                const versionOutput = await versionResult.outcome;
                logger.info(`Pod version: ${versionOutput.trim()}`);
            } catch (versionError) {
                const errorMsg =
                    "Cannot execute pod command. Please ensure CocoaPods is properly installed.";
                logger.error(errorMsg);
                void vscode.window.showErrorMessage(errorMsg);
                throw new Error(errorMsg);
            }
            logger.info(`Executing: ${podCommand} install`);
            const installResult = await childProcess.exec(`${podCommand} install`, {
                cwd: iosPath,
                env: enhancedEnv,
                maxBuffer: 1024 * 1024 * 10,
                timeout: 300000,
            });
            const stdout = await installResult.outcome;
            if (stdout) {
                logger.info(stdout);
            }
            logger.info("CocoaPods installation completed successfully");
            void vscode.window.showInformationMessage(
                "CocoaPods dependencies installed successfully.",
            );
        } catch (error: any) {
            let errorMessage = "Unknown error";
            let stderr = "";
            let stdout = "";
            if (error instanceof Error) {
                errorMessage = error.message || "Unknown error";
            }
            if (error && typeof error === "object") {
                if ("stderr" in error && error.stderr) {
                    stderr = String(error.stderr);
                }
                if ("stdout" in error && error.stdout) {
                    stdout = String(error.stdout);
                }
            }
            const suggestion = this.getSuggestionForError(`${errorMessage} ${stderr}`);
            const baseMessage = "Failed to install CocoaPods dependencies.";
            let fullErrorMessage = `${baseMessage}\n${errorMessage}`;
            if (stderr) {
                fullErrorMessage = `${fullErrorMessage}\n\nError details:\n${stderr}`;
            }
            if (suggestion) {
                fullErrorMessage = `${fullErrorMessage}\n\n${suggestion}`;
            }
            logger.error(fullErrorMessage);
            if (stdout) {
                logger.info(`Command output: ${stdout}`);
            }
            if (error instanceof Error && error.stack) {
                logger.error(`Stack trace: ${error.stack}`);
            }
            void vscode.window.showErrorMessage(fullErrorMessage);
            const enhancedError = new Error(fullErrorMessage);
            if (error instanceof Error && error.stack) {
                enhancedError.stack = error.stack;
            }
            throw enhancedError;
        }
    }

    private findPodCommand(): string {
        const homeDir = os.homedir();
        const possiblePodPaths = [
            `${homeDir}/.rbenv/shims/pod`,
            `${homeDir}/.rvm/bin/pod`,
            "/opt/homebrew/bin/pod",
            "/usr/local/bin/pod",
            "/Library/Ruby/Gems/2.6.0/bin/pod",
            "/Library/Ruby/Gems/3.0.0/bin/pod",
            "/Library/Ruby/Gems/3.3.0/bin/pod",
        ];
        logger.info("Searching for pod command...");
        for (const possiblePath of possiblePodPaths) {
            if (fs.existsSync(possiblePath)) {
                try {
                    fs.accessSync(possiblePath, fs.constants.X_OK);
                    logger.info(`Found executable pod at: ${possiblePath}`);
                    return possiblePath;
                } catch (accessError) {
                    logger.warning(`Found pod at ${possiblePath} but it's not executable`);
                }
            }
        }
        logger.warning("Pod command not found in common locations, using 'pod' from PATH");
        return "pod";
    }

    private getEnhancedEnvironment(): { [key: string]: string } {
        const env = { ...process.env } as { [key: string]: string };
        const homeDir = os.homedir();
        logger.info(`Using HOME directory: ${homeDir}`);
        const rbenvRoot = process.env.RBENV_ROOT || `${homeDir}/.rbenv`;
        env.RBENV_ROOT = rbenvRoot;
        logger.info(`RBENV_ROOT: ${rbenvRoot}`);
        const rbenvShims = `${rbenvRoot}/shims`;
        const rbenvBin = `${rbenvRoot}/bin`;
        const additionalPaths = [
            rbenvShims,
            rbenvBin,
            "/usr/local/bin",
            "/opt/homebrew/bin",
            "/opt/homebrew/sbin",
            `${homeDir}/.rvm/bin`,
            `${homeDir}/.gem/ruby/2.6.0/bin`,
            `${homeDir}/.gem/ruby/3.0.0/bin`,
            `${homeDir}/.gem/ruby/3.3.0/bin`,
            "/Library/Ruby/Gems/2.6.0/bin",
            "/Library/Ruby/Gems/3.0.0/bin",
            "/Library/Ruby/Gems/3.3.0/bin",
            "/System/Library/Frameworks/Ruby.framework/Versions/Current/usr/bin",
            "/usr/bin",
            "/bin",
            "/usr/sbin",
            "/sbin",
        ];
        const originalPath = env.PATH || "";
        const originalPathArray = originalPath
            .split(":")
            .filter(p => !p.includes(".rbenv") && p.trim() !== "");
        const allPaths = [...additionalPaths, ...originalPathArray];
        const uniquePaths = Array.from(new Set(allPaths)).filter(Boolean);
        env.PATH = uniquePaths.join(":");
        logger.info(`Enhanced PATH: ${env.PATH}`);
        if (!env.SHELL) {
            env.SHELL = "/bin/zsh";
        }
        if (process.env.RBENV_VERSION) {
            env.RBENV_VERSION = process.env.RBENV_VERSION;
        }
        if (process.env.GEM_HOME) {
            env.GEM_HOME = process.env.GEM_HOME;
        }
        if (process.env.GEM_PATH) {
            env.GEM_PATH = process.env.GEM_PATH;
        }
        env.LC_ALL = env.LC_ALL || "en_US.UTF-8";
        env.LANG = env.LANG || "en_US.UTF-8";
        return env;
    }

    private isCDNError(errorMessage: string): boolean {
        const cdnDomains = ["trunk.cocoapods.org", "cdn.cocoapods.org"];
        if (errorMessage.toLowerCase().includes("cdn")) {
            return true;
        }
        const urlPattern = /https?:\/\/\S+/gi;
        const urls = errorMessage.match(urlPattern);
        if (!urls) {
            return cdnDomains.some(domain => errorMessage.includes(domain));
        }
        for (const urlString of urls) {
            try {
                const parsedUrl = new url.URL(urlString);
                const hostname = parsedUrl.hostname.toLowerCase();
                for (const domain of cdnDomains) {
                    if (hostname === domain || hostname.endsWith(`.${domain}`)) {
                        return true;
                    }
                }
            } catch (e) {
                continue;
            }
        }
        return false;
    }

    private getSuggestionForError(errorMessage: string): string {
        if (
            errorMessage.includes("command not found") ||
            errorMessage.includes("pod: not found") ||
            errorMessage.includes("'pod' is not recognized") ||
            errorMessage.includes("Cannot execute pod command")
        ) {
            return "CocoaPods may not be installed or not accessible. Install it via:\n  • System Ruby: sudo gem install cocoapods\n  • Homebrew: brew install cocoapods\n  • rbenv: gem install cocoapods\nAfter installation, please restart VS Code to refresh the environment.";
        }
        if (this.isCDNError(errorMessage)) {
            return "CDN error. Try running 'pod repo update' in the terminal.";
        }
        if (errorMessage.includes("Xcode") || errorMessage.includes("xcrun")) {
            return "Xcode command line tools may be missing. Run 'xcode-select --install' in the terminal.";
        }
        if (errorMessage.includes("ruby") || errorMessage.includes("Ruby")) {
            return "Ruby environment issue. Check your Ruby installation and version with 'ruby --version'.";
        }
        if (errorMessage.includes("permission") || errorMessage.includes("Permission")) {
            return "Permission denied. Try checking directory permissions or running the command with appropriate privileges.";
        }
        if (errorMessage.includes("Gem::") || errorMessage.includes("gem")) {
            return "Ruby gem issue. Try updating your gems with 'gem update --system' or 'sudo gem update --system'.";
        }
        return "";
    }
}
