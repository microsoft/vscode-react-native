import * as path from "path";
import { _electron as electron, ElectronApplication, Page } from "playwright";
import { downloadAndUnzipVSCode, resolveCliArgsFromVSCodeExecutablePath } from "@vscode/test-electron";
import * as utilities from "./utilities";
import { SmokeTestLogger } from "./smokeTestLogger";
import * as fs from "fs";
import * as rimraf from "rimraf";

export class Application {
    private app: ElectronApplication | null = null;
    private page: Page | null = null;
    private extensionDirectory = path.join(__dirname, "..", "..", ".vscode-test", "extensions");
    private userDataDirectory = path.join(__dirname, "..", "..", ".vscode-test", "user-data");
    private vsixDirectory = path.join(__dirname, "..", "..", "resources", "extension");

    async downloadVSCodeExecutable(): Promise<string> {
        const vscodeExecutablePath = await downloadAndUnzipVSCode("stable");
        return vscodeExecutablePath;
    }

    async launch(): Promise<Page> {
        if (this.page) return this.page;

        const vscodeExecutablePath = await this.downloadVSCodeExecutable();

        const [...args] = resolveCliArgsFromVSCodeExecutablePath(vscodeExecutablePath);

        this.app = await electron.launch({
            executablePath: vscodeExecutablePath,
            args: [path.resolve(__dirname, ".."), ...args],
        });

        this.page = await this.app.firstWindow();
        await this.page.waitForSelector(".monaco-workbench");

        return this.page;
    }

    async close(): Promise<void> {
        if (fs.existsSync(this.userDataDirectory)) {
            SmokeTestLogger.info(
                `*** Deleting VS Code temporary user data dir: ${this.userDataDirectory}`,
            );
            rimraf.sync(this.userDataDirectory);
        }
        if (this.app) {
            await this.app.close();
            this.app = null;
            this.page = null;
        }
    }

    async installExtensionFromVSIX(vscodeExecutablePath: string): Promise<void> {
        const [cliPath, ...args] = resolveCliArgsFromVSCodeExecutablePath(vscodeExecutablePath);
        args.push(`--extensions-dir=${this.extensionDirectory}`);
        let extensionFile = utilities.findFile(this.vsixDirectory, /.*\.(vsix)/);
        if (!extensionFile) {
            throw new Error(
                `React Native extension .vsix is not found in ${this.vsixDirectory}`,
            );
        }

        extensionFile = path.join(this.vsixDirectory, extensionFile);
        args.push(`--install-extension=${extensionFile}`);

        utilities.spawnSync(cliPath, args, { stdio: "inherit" });
    }

    getPage(): Page {
        if (!this.page) {
            throw new Error("VSCode has not been launched yet.");
        }
        return this.page;
    }
}
