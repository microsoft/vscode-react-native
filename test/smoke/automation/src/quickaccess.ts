// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.

import { Editors } from "./editors";
import { Code } from "./code";
import { QuickInput } from "./quickinput";

export class QuickAccess {
    constructor(private code: Code, private editors: Editors, private quickInput: QuickInput) { }

    public async openQuickAccess(value: string): Promise<void> {
        let retries = 0;

        // other parts of code might steal focus away from quickinput :(
        while (retries < 5) {
            if (process.platform === "darwin") {
                await this.code.dispatchKeybinding("cmd+p");
            } else {
                await this.code.dispatchKeybinding("ctrl+p");
            }

            try {
                await this.quickInput.waitForQuickInputOpened(10);
                break;
            } catch (err) {
                if (++retries > 5) {
                    throw err;
                }

                await this.code.dispatchKeybinding("escape");
            }
        }

        if (value) {
            await this.code.waitForSetValue(QuickInput.QUICK_INPUT_INPUT, value);
        }
    }

    public async openFile(fileName: string, retryCount: number = 10): Promise<void> {
        // await this.openQuickAccess(fileName);

        let tryes = retryCount;
        while (tryes > 0) {
            try {
                await this.openQuickAccess(fileName);
                await this.quickInput.waitForQuickInputElements(names => names[0] === fileName, 10, 1000);
                await this.code.dispatchKeybinding("enter");
                await this.editors.waitForActiveTab(fileName, false, false, 10, 1000);
                await this.editors.waitForEditorFocus(fileName, 10, 1000);
                break;
            } catch (e) {
                await this.code.dispatchKeybinding("escape");
                tryes--;
            }
        }
        // els => accept(els.map(e => e.textContent))

        // const code = this.code;

        // const wait = async function waitForElements(selector: string, recursive: boolean, accept: (result: IElement[]) => boolean = result => result.length > 0): Promise<IElement[]> {
        //     const windowId = await code.getActiveWindowId();
        //     return await poll(() => this.driver.getElements(windowId, selector, recursive), accept, `get elements '${selector}'`);
        // }

    }

    public async runCommand(commandId: string, retryCount: number = 10): Promise<void> {
        let tryes = retryCount;
        while (tryes > 0) {
            try {
                await this.openQuickAccess(`>${commandId}`);
                // wait for best choice to be focused
                await this.code.waitForTextContent(QuickInput.QUICK_INPUT_FOCUSED_ELEMENT, undefined, undefined, 10, 1000);
                // wait and click on best choice
                await this.quickInput.selectQuickInputElement(0, true, 10, 1000);
                break;
            } catch (e) {
                await this.code.dispatchKeybinding("escape");
                tryes--;
            }
        }
    }

    public async openQuickOutline(): Promise<void> {
        let retries = 0;

        while (++retries < 10) {
            if (process.platform === "darwin") {
                await this.code.dispatchKeybinding("cmd+shift+o");
            } else {
                await this.code.dispatchKeybinding("ctrl+shift+o");
            }

            const text = await this.code.waitForTextContent(QuickInput.QUICK_INPUT_ENTRY_LABEL_SPAN);

            if (text !== "No symbol information for the file") {
                return;
            }

            await this.quickInput.closeQuickInput();
            await new Promise(c => setTimeout(c, 250));
        }
    }

    public async runDebugScenario(scenario: string, index?: number, retryCount: number = 10): Promise<void> {
        let tryes = retryCount;
        while (tryes > 0) {
            try {
                await this.openQuickAccess(`debug ${scenario}`);
                if (index) {
                    for (let from = 0; from < index; from++) {
                        await this.code.dispatchKeybinding("down");
                    }
                }
                // wait for the best choice to be focused
                await this.code.waitForTextContent(QuickInput.QUICK_INPUT_FOCUSED_ELEMENT, scenario, undefined, 10, 1000);
                // wait and click on the best choice
                await this.code.waitAndClick(QuickInput.QUICK_INPUT_FOCUSED_ELEMENT, 10, 1000);
                break;
            } catch (e) {
                await this.code.dispatchKeybinding("escape");
                tryes--;
            }
        }
    }
}
