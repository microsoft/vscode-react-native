import { Page } from "playwright";
import { SmokeTestLogger } from "./smokeTestLogger";

export class Extension {
    async checkExtensionActivated(page: Page): Promise<boolean> {
        const prodExtensionId = "msjsdiag.vscode-react-native.togglePackagerItem";
        const previewExtensionId = "msjsdiag.vscode-react-native-preview.togglePackagerItem";

        try {
            await page.waitForSelector(`[id="${previewExtensionId}"]`, { timeout: 2000 });
            SmokeTestLogger.info("React-native-preview extension is activated");
            return true;
        } catch {
            try {
                await page.waitForSelector(`[id="${prodExtensionId}"]`, { timeout: 2000 });
                SmokeTestLogger.info("React-native-prod extension is activated");
                return true;
            } catch {
                return false;
            }
        }
    }
}
