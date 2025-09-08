import * as fs from "fs";
import * as mkdirp from "mkdirp";
import * as path from "path";
import { app } from "../main";

export class Screenshots {
    private application = app;
    private screenshotFolder = path.join(__dirname, "..", "..", "screenshots");

    async createScreenshotsFolder(platform: string): Promise<void> {
        if (!fs.existsSync(this.screenshotFolder)) {
            mkdirp.sync(path.join(this.screenshotFolder, platform));
        }
    }

    async prepareScreenshotFolderForPlatform(): Promise<string> {
        switch (process.platform) {
            case "win32":
                await this.createScreenshotsFolder("windows");
                return "windows";
            case "linux":
                await this.createScreenshotsFolder("linux");
                return "linux";
            case "darwin":
                await this.createScreenshotsFolder("macos");
                return "macos";
            default:
                return "other";
        }
    }

    async takeScreenshots(suiteName: string, fileName: string): Promise<void> {
        const platform = await this.prepareScreenshotFolderForPlatform();

        const mainPage = this.application.getMainPage();
        await mainPage.screenshot({
            path: `screenshots/${platform}/${suiteName}/${fileName}.jpg`,
            fullPage: true,
        });
    }
}
