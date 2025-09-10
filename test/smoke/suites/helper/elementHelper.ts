import { ElementHandle, Page } from "playwright";
import { app } from "../main";

export class ElementHelper {
    static setPage(): Page {
        const application = app;
        return application.getMainPage();
    }

    public static async openCommandPalette() {
        const cmdKey = process.platform === "darwin" ? "Meta" : "Control";
        await this.setPage().keyboard.press(`${cmdKey}+Shift+P`);
    }

    public static async inputText(input: string) {
        await this.setPage().keyboard.type(input);
    }

    public static async WaitElementClassNameVisible(
        className: string,
        timeout: number,
    ): Promise<ElementHandle<SVGElement | HTMLElement>> {
        const element = await this.setPage().waitForSelector(`.${className}`, { timeout: timeout });
        return element;
    }

    public static async WaitElementIdVisible(
        id: string,
        timeout: number,
    ): Promise<ElementHandle<SVGElement | HTMLElement>> {
        const element = await this.setPage().waitForSelector(`#${id}`, { timeout: timeout });
        return element;
    }

    public static async WaitElementSelectorVisible(
        selector: string,
        timeout: number,
    ): Promise<ElementHandle<SVGElement | HTMLElement>> {
        const element = await this.setPage().waitForSelector(selector, { timeout: timeout });
        return element;
    }
}
