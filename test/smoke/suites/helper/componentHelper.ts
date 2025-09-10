import { ElementHandle, Page } from "playwright";
import { app } from "../main";
import { ElementHelper } from "./elementHelper";
import { Element } from "./constants";
import { SmokeTestLogger } from "./smokeTestLogger";

export class ComponentHelper {
    static setPage(): Page {
        const application = app;
        return application.getMainPage();
    }

    public static async openCommandPalette() {
        const cmdKey = process.platform === "darwin" ? "Meta" : "Control";
        await ElementHelper.sendKeys(`${cmdKey}+Shift+P`);
    }

    public static async openFileExplorer() {
        try {
            await ElementHelper.WaitElementSelectorVisible(`[id="${Element.fileExplorerViewId}"]`);
            SmokeTestLogger.log("File explorer view is already opened.");
        } catch {
            const explorerIcon = await ElementHelper.WaitElementSelectorVisible(
                Element.fileExplorerIconSelector,
            );
            explorerIcon.click();
            await ElementHelper.WaitElementSelectorVisible(
                `[id="${Element.fileExplorerViewId}"]`,
                2000,
            );
        }
    }

    public static async WaitFileVisibleInFileExplorer(
        fileName: string,
    ): Promise<ElementHandle<SVGElement | HTMLElement> | null> {
        try {
            return await ElementHelper.WaitElementSelectorVisible(
                `[aria-label="${fileName}"]`,
                2000,
            );
        } catch {
            return null;
        }
    }
}
