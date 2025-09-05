import * as path from "path";
import { _electron as electron, ElectronApplication, Page } from "playwright";
import {
    downloadAndUnzipVSCode,
    resolveCliArgsFromVSCodeExecutablePath,
} from "@vscode/test-electron";
import * as utilities from "./utilities";
import { SmokeTestLogger } from "./smokeTestLogger";
import * as fs from "fs";
import * as rimraf from "rimraf";
import { Extension } from "./extension";

export class Application {
    private app: ElectronApplication | null = null;
    private mainPage: Page | null = null;
    private extension: Extension | null = null;
    private extensionDirectory = path.join(__dirname, "..", "..", ".vscode-test", "extensions");
    private userDataDirectory = path.join(__dirname, "..", "..", ".vscode-test", "temp-user-data");
    private vsixDirectory = path.join(__dirname, "..", "..", "resources", "extension");
    private projectPath = path.join(__dirname, "..", "..", "resources", "sampleReactNativeProject");

    async downloadVSCodeExecutable(): Promise<string> {
        const vscodeExecutablePath = await downloadAndUnzipVSCode("stable");
        return vscodeExecutablePath;
    }

    async launch(): Promise<Page> {
        if (this.mainPage) return this.mainPage;

        const vscodeExecutablePath = await this.downloadVSCodeExecutable();

        const [...args] = resolveCliArgsFromVSCodeExecutablePath(vscodeExecutablePath);
        args.push("--disable-workspace-trust");
        args.push("--no-sandbox");

        const userDataIndex = args.findIndex(arg => arg.startsWith("--user-data-dir="));
        if (userDataIndex >= 0) {
            args[userDataIndex] = `--user-data-dir=${this.userDataDirectory}`;
        } else {
            args.push(`--user-data-dir=${this.userDataDirectory}`);
        }

        this.app = await electron.launch({
            executablePath: vscodeExecutablePath,
            args: [this.projectPath, ...args],
        });

        this.mainPage = await this.app.firstWindow();
        await this.mainPage.waitForSelector(".monaco-workbench");

        await utilities.sleep(5000);
        return this.mainPage;
    }

    async close(): Promise<void> {
        try {
            await this.cleanUserData();
        } catch {
            SmokeTestLogger.info("Cannot clean up user data, will try it again in test setup.");
        }

        try {
            await this.cleanExtensionData();
        } catch {
            SmokeTestLogger.info(
                "Cannot clean up extension data, will try it again in test setup.",
            );
        }

        if (this.app) {
            await this.app.close();
            this.app = null;
            this.mainPage = null;
        }
    }

    async installExtensionFromVSIX(vscodeExecutablePath: string): Promise<Extension> {
        const [cliPath, ...args] = resolveCliArgsFromVSCodeExecutablePath(vscodeExecutablePath);
        args.push(`--extensions-dir=${this.extensionDirectory}`);
        let extensionFile = utilities.findFile(this.vsixDirectory, /.*\.(vsix)/);
        if (!extensionFile) {
            throw new Error(`React Native extension .vsix is not found in ${this.vsixDirectory}`);
        }

        extensionFile = path.join(this.vsixDirectory, extensionFile);
        args.push(`--install-extension=${extensionFile}`);

        if (process.platform == "win32") {
            utilities.spawnSync(cliPath, args, { stdio: "inherit", shell: true });
        } else {
            utilities.spawnSync(cliPath, args, { stdio: "inherit" });
        }

        this.extension = new Extension();
        return this.extension;
    }

    getMainPage(): Page {
        if (!this.mainPage) {
            throw new Error("VSCode has not been launched yet.");
        }
        return this.mainPage;
    }

    async cleanUserData(): Promise<void> {
        if (fs.existsSync(this.userDataDirectory)) {
            SmokeTestLogger.info(
                `*** Deleting VS Code temporary user data dir: ${this.userDataDirectory}`,
            );
            rimraf.sync(this.userDataDirectory);
        }
    }

    async cleanExtensionData(): Promise<void> {
        if (fs.existsSync(this.extensionDirectory)) {
            SmokeTestLogger.info(
                `*** Deleting VS Code temporary user data dir: ${this.extensionDirectory}`,
            );
            rimraf.sync(this.extensionDirectory);
        }
    }
}
