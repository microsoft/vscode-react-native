import { app } from "../main";
import { waitConditionUntil } from "./utilities";

export class Extension {
    private application = app;
    private extensionId = "msjsdiag.vscode-react-native";

    async waitForExtensionActive(): Promise<void> {
        const mainPage = this.application.getMainPage();
        if (!mainPage) {
            throw new Error("VSCode must be launched before waiting for extension activation.");
        }
        await waitConditionUntil(
            () =>
                (window as any).vscode?.extensions?.getExtension(this.extensionId)?.isActive ==
                true,
            1000,
            10000,
        );
    }
}
