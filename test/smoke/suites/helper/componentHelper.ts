import { ElementHandle, Page } from "playwright";
import { app } from "../main";
import { ElementHelper } from "./elementHelper";
import { Constant, Element } from "./constants";
import { WaitHelper } from "./waitHelper";
import { SmokeTestLogger } from "./smokeTestLogger";
import { TimeoutConstants } from "./timeoutConstants";

export class ComponentHelper {
    static Page(): Page {
        const application = app;
        return application.getMainPage();
    }

    public static async openCommandPalette() {
        const cmdKey = process.platform === "darwin" ? "Meta" : "Control";
        await ElementHelper.sendKeys(`${cmdKey}+Shift+P`);
    }

    public static async executeCommand(commandName: string) {
        await this.openCommandPalette();
        await ElementHelper.WaitElementClassNameVisible(
            Element.commandPaletteClassName,
            TimeoutConstants.COMMAND_PALETTE_TIMEOUT,
        );

        // Type the command name to search for it
        await ElementHelper.inputText(commandName);

        // Wait for the command to appear in the list
        await ElementHelper.WaitElementSelectorVisible(
            Element.commandPaletteFocusedItemSelector,
            TimeoutConstants.COMMAND_PALETTE_TIMEOUT,
        );

        // Press Enter to execute the command
        await ElementHelper.sendKeys("Enter");
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

    public static async waitPackagerStateIncludes(
        expected: string,
        timeout: number = 30000,
    ): Promise<void> {
        const ok = await WaitHelper.waitIsTrue(async () => {
            const packager = await this.getReactNativePackager();
            const currentState = await packager.getAttribute("aria-label");
            return !!currentState?.includes(expected);
        }, timeout);
        if (!ok) {
            throw new Error(`Packager state did not include "${expected}" within ${timeout}ms`);
        }
    }

    public static async waitPackagerStateIncludesOneOf(
        expectedList: string[],
        timeout: number = 30000,
    ): Promise<void> {
        const ok = await WaitHelper.waitIsTrue(async () => {
            const packager = await this.getReactNativePackager();
            const currentState = await packager.getAttribute("aria-label");
            return expectedList.some(exp => currentState?.includes(exp));
        }, timeout);
        if (!ok) {
            throw new Error(
                `Packager state did not include any of ${expectedList
                    .map(e => `"${e}"`)
                    .join(", ")} within ${timeout}ms`,
            );
        }
    }
}
