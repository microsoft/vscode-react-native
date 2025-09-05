import * as fs from "fs";
import * as mkdirp from "mkdirp";
import * as path from "path";
import { app } from "../main";

export class Screenshots {
    private application = app;
    private screenshotFolder = path.join(__dirname, "..", "..", "screenshots");

    async createScreenshotsFolder(): Promise<void> {
        if (!fs.existsSync(this.screenshotFolder)) {
            mkdirp.sync(this.screenshotFolder);
        }
    }

    async takeScreenshots(fileName: string): Promise<void> {
        await this.createScreenshotsFolder();

        const mainPage = this.application.getMainPage();
        await mainPage.screenshot({
            path: `screenshots/commandPaletteTest/${fileName}.jpg`,
            fullPage: true,
        });
    }
}
