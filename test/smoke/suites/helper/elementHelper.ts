import { ElementHandle, Page } from "playwright";
import { app } from "../main";

export class ElementHelper {
    static Page(): Page {
        const application = app;
        return application.getMainPage();
    }

    public static async inputText(input: string) {
        await this.Page().keyboard.type(input);
    }

    public static async sendKeys(keys: string) {
        await this.Page().keyboard.press(keys);
    }

    public static async mouseClick(element: ElementHandle<SVGElement | HTMLElement>) {
        const location = await element.boundingBox();
        if (location) {
            await this.Page().mouse.click(
                location.x + location.width / 2,
                location.y + location.height / 2,
            );
        } else {
            throw new Error("Cannot get element's location.");
        }
    }

    public static async clickElementByText(text: string) {
        await this.Page().click(`text=${text}`);
    }

    public static async waitPageLoad(
        state: "load" | "domcontentloaded" | "networkidle" | undefined,
    ) {
        await this.Page().waitForLoadState(state);
    }

    public static async WaitElementClassNameVisible(
        className: string,
        timeout: number = 1000,
    ): Promise<ElementHandle<SVGElement | HTMLElement>> {
        const element = await this.Page().waitForSelector(`.${className}`, { timeout: timeout });
        return element;
    }

    public static async WaitElementIdVisible(
        id: string,
        timeout: number = 1000,
    ): Promise<ElementHandle<SVGElement | HTMLElement>> {
        const element = await this.Page().waitForSelector(`#${id}`, { timeout: timeout });
        return element;
    }

    public static async WaitElementSelectorVisible(
        selector: string,
        timeout: number = 1000,
    ): Promise<ElementHandle<SVGElement | HTMLElement>> {
        const element = await this.Page().waitForSelector(selector, { timeout: timeout });
        return element;
    }

    public static async WaitElementAriaLabelVisible(
        label: string,
        timeout: number = 1000,
    ): Promise<ElementHandle<SVGElement | HTMLElement>> {
        const element = await this.Page().waitForSelector(`[aria-label="${label}"]`, {
            timeout: timeout,
        });
        return element;
    }

    public static async TryFindElement(
        selector: string,
        timeout: number = 1000,
    ): Promise<ElementHandle<SVGElement | HTMLElement> | null> {
        try {
            const element = await this.Page().waitForSelector(selector, {
                timeout: timeout,
            });
            return element;
        } catch {
            return null;
        }
    }
}
