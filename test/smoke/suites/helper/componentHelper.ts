import { ElementHandle, Page } from "playwright";
import { app } from "../main";
import { ElementHelper } from "./elementHelper";
import { Constant, Element } from "./constants";
import { SmokeTestLogger } from "./smokeTestLogger";

export class ComponentHelper {
    static Page(): Page {
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
            await explorerIcon.click();
            await ElementHelper.WaitElementSelectorVisible(
                `[id="${Element.fileExplorerViewId}"]`,
                2000,
            );
        }
    }

    public static async openRunAndDebugTab() {
        const debugIcon = await ElementHelper.WaitElementClassNameVisible(
            Element.runAndDebugTabButtonClassName,
        );
        await debugIcon.click();
    }

    public static async WaitFileVisibleInFileExplorer(
        fileName: string,
    ): Promise<ElementHandle<SVGElement | HTMLElement> | null> {
        try {
            return await ElementHelper.WaitElementAriaLabelVisible(fileName, 2000);
        } catch {
            return null;
        }
    }

    public static async getReactNativePackager(): Promise<ElementHandle<SVGElement | HTMLElement>> {
        let packager: ElementHandle<SVGElement | HTMLElement>;
        try {
            packager = await ElementHelper.WaitElementSelectorVisible(
                `[id="${Constant.previewExtensionId}"]`,
                2000,
            );
        } catch {
            packager = await ElementHelper.WaitElementSelectorVisible(
                `[id="${Constant.prodExtensionId}"]`,
                2000,
            );
        }

        return packager;
    }
}
