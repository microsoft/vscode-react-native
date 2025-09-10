import { ElementHandle, Page } from "playwright";
import { app } from "../main";

export class ElementHelper {
    static setPage(): Page {
        const application = app;
        return application.getMainPage();
    }

    public static async inputText(input: string) {
        await this.setPage().keyboard.type(input);
    }

    public static async sendKeys(keys: string) {
        await this.setPage().keyboard.press(keys);
    }

    public static async WaitElementClassNameVisible(
        className: string,
        timeout: number = 1000,
    ): Promise<ElementHandle<SVGElement | HTMLElement>> {
        const element = await this.setPage().waitForSelector(`.${className}`, { timeout: timeout });
        return element;
    }

    public static async WaitElementIdVisible(
        id: string,
        timeout: number = 1000,
    ): Promise<ElementHandle<SVGElement | HTMLElement>> {
        const element = await this.setPage().waitForSelector(`#${id}`, { timeout: timeout });
        return element;
    }

    public static async WaitElementSelectorVisible(
        selector: string,
        timeout: number = 1000,
    ): Promise<ElementHandle<SVGElement | HTMLElement>> {
        const element = await this.setPage().waitForSelector(selector, { timeout: timeout });
        return element;
    }
}
