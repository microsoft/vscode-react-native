// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.

import { Editors } from "./editors";
import { Code } from "./code";

export class QuickOpen {

    public static QUICK_OPEN = "div.monaco-quick-open-widget";
    public static QUICK_OPEN_HIDDEN = "div.monaco-quick-open-widget[aria-hidden=\"true\"]";
    public static QUICK_OPEN_INPUT = `${QuickOpen.QUICK_OPEN} .quick-open-input input`;
    public static QUICK_OPEN_FOCUSED_ELEMENT = `${QuickOpen.QUICK_OPEN} .quick-open-tree .monaco-tree-row.focused .monaco-highlighted-label`;
    public static QUICK_OPEN_ENTRY_SELECTOR = "div[aria-label=\"Quick Picker\"] .monaco-tree-rows.show-twisties .monaco-tree-row .quick-open-entry";
    public static QUICK_OPEN_ENTRY_LABEL_SELECTOR = "div[aria-label=\"Quick Picker\"] .monaco-tree-rows.show-twisties .monaco-tree-row .quick-open-entry .label-name";

    constructor(private code: Code, private editors: Editors) { }

    public async openQuickOpen(value?: string): Promise<void> {
        let retries = 0;

        // other parts of code might steal focus away from quickopen :(
        while (retries < 5) {
            if (process.platform === "darwin") {
                await this.code.dispatchKeybinding("cmd+p");
            } else {
                await this.code.dispatchKeybinding("ctrl+p");
            }

            try {
                await this.waitForQuickOpenOpened();
                break;
            } catch (err) {
                if (++retries > 5) {
                    throw err;
                }

                await this.code.dispatchKeybinding("escape");
            }
        }

        if (value) {
            await this.code.waitForSetValue(QuickOpen.QUICK_OPEN_INPUT, value);
        }
    }

    public async closeQuickOpen(): Promise<void> {
        await this.code.dispatchKeybinding("escape");
        await this.waitForQuickOpenClosed();
    }

    public async openFile(fileName: string): Promise<void> {
        await this.openQuickOpen(fileName);

        await this.waitForQuickOpenElements(names => names[0] === fileName);
        await this.code.dispatchKeybinding("enter");
        await this.editors.waitForActiveTab(fileName);
        await this.editors.waitForEditorFocus(fileName);
    }

    public async waitForQuickOpenOpened(): Promise<void> {
        await this.code.waitForActiveElement(QuickOpen.QUICK_OPEN_INPUT);
    }

    public async submit(text: string): Promise<void> {
        await this.code.waitForSetValue(QuickOpen.QUICK_OPEN_INPUT, text);
        await this.code.dispatchKeybinding("enter");
        await this.waitForQuickOpenClosed();
    }

    public async selectQuickOpenElement(index: number): Promise<void> {
        await this.waitForQuickOpenOpened();
        for (let from = 0; from < index; from++) {
            await this.code.dispatchKeybinding("down");
        }
        await this.code.dispatchKeybinding("enter");
        await this.waitForQuickOpenClosed();
    }

    public async waitForQuickOpenElements(accept: (names: string[]) => boolean): Promise<void> {
        await this.code.waitForElements(QuickOpen.QUICK_OPEN_ENTRY_LABEL_SELECTOR, false, els => accept(els.map(e => e.textContent)));
    }

    public async runCommand(command: string): Promise<void> {
        await this.openQuickOpen(`> ${command}`);

        // wait for best choice to be focused
        await this.code.waitForTextContent(QuickOpen.QUICK_OPEN_FOCUSED_ELEMENT, command);

        // wait and click on best choice
        await this.code.waitAndClick(QuickOpen.QUICK_OPEN_FOCUSED_ELEMENT);
    }

    public async runDebugScenario(scenario: string): Promise<void> {
        await this.openQuickOpen(`debug ${scenario}`);

        // wait for the best choice to be focused
        await this.code.waitForTextContent(QuickOpen.QUICK_OPEN_FOCUSED_ELEMENT, scenario);

        // wait and click on the best choice
        await this.code.waitAndClick(QuickOpen.QUICK_OPEN_FOCUSED_ELEMENT);
    }

    public async openQuickOutline(): Promise<void> {
        let retries = 0;

        while (++retries < 10) {
            if (process.platform === "darwin") {
                await this.code.dispatchKeybinding("cmd+shift+o");
            } else {
                await this.code.dispatchKeybinding("ctrl+shift+o");
            }

            const text = await this.code.waitForTextContent("div[aria-label=\"Quick Picker\"] .monaco-tree-rows.show-twisties div.monaco-tree-row .quick-open-entry .monaco-icon-label .label-name .monaco-highlighted-label span");

            if (text !== "No symbol information for the file") {
                return;
            }

            await this.closeQuickOpen();
            await new Promise(c => setTimeout(c, 250));
        }
    }

    private async waitForQuickOpenClosed(): Promise<void> {
        await this.code.waitForElement(QuickOpen.QUICK_OPEN_HIDDEN);
    }
}
