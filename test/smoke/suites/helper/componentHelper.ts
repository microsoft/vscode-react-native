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

    public static async closeCommandPalette() {
        await ElementHelper.sendKeys("Escape");
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
            return await ElementHelper.WaitElementAriaLabelVisible(
                fileName,
                TimeoutConstants.FILE_EXPLORER_TIMEOUT,
            );
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
        await this.waitUntil(
            async () => {
                const packager = await this.getReactNativePackager();
                const currentState = (await packager.getAttribute("aria-label")) || "<empty>";
                return {
                    ok: currentState.includes(expected),
                    actual: currentState,
                };
            },
            {
                operation: "packager state update",
                expected: `state includes \"${expected}\"`,
                timeout,
            },
        );
    }

    public static async waitPackagerStateIncludesOneOf(
        expectedList: string[],
        timeout: number = 30000,
    ): Promise<void> {
        await this.waitUntil(
            async () => {
                const packager = await this.getReactNativePackager();
                const currentState = (await packager.getAttribute("aria-label")) || "<empty>";
                return {
                    ok: expectedList.some(exp => currentState.includes(exp)),
                    actual: currentState,
                };
            },
            {
                operation: "packager state update",
                expected: `state includes one of ${expectedList.map(e => `\"${e}\"`).join(", ")}`,
                timeout,
            },
        );
    }

    public static async isPackagerStateIncludesOneOf(
        expectedList: string[],
        timeout: number = 30000,
    ): Promise<boolean> {
        return WaitHelper.waitIsTrue(async () => {
            const packager = await this.getReactNativePackager();
            const currentState = await packager.getAttribute("aria-label");
            return expectedList.some(exp => currentState?.includes(exp));
        }, timeout);
    }

    public static async waitUntil<T>(
        condition: () => Promise<{ ok: boolean; actual?: string; value?: T }>,
        options: {
            operation: string;
            expected: string;
            timeout?: number;
            interval?: number;
        },
    ): Promise<T | undefined> {
        const timeout = options.timeout ?? 30000;
        const interval = options.interval ?? 1000;
        let lastActual = "<unavailable>";
        let lastValue: T | undefined;

        const ok = await WaitHelper.waitIsTrue(
            async () => {
                const result = await condition();
                if (result.actual !== undefined) {
                    lastActual = result.actual;
                }
                if (result.value !== undefined) {
                    lastValue = result.value;
                }

                return result.ok;
            },
            timeout,
            interval,
        );

        if (!ok) {
            throw new Error(
                `[WaitTimeout] ${options.operation}. Expected: ${options.expected}. Last actual: ${lastActual}. Timeout: ${timeout}ms. Interval: ${interval}ms.`,
            );
        }

        return lastValue;
    }
}
