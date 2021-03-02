// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.

import { Viewlet } from "./viewlet";
import { Code, executeWithSpecifiedPollRetryParameters } from "./code";

const VIEWLET = ".search-view";
const INPUT = `${VIEWLET} .search-widget .search-container .monaco-inputbox textarea`;
const INCLUDE_INPUT = `${VIEWLET} .query-details .file-types.includes .monaco-inputbox input`;
const FILE_MATCH = (filename: string) => `${VIEWLET} .results .filematch[data-resource$="${filename}"]`;

async function retry(setup: () => Promise<any>, attempt: () => Promise<any>) {
    let count = 0;
    while (true) {
        await setup();

        try {
            await attempt();
            return;
        } catch (err) {
            if (++count > 5) {
                throw err;
            }
        }
    }
}

export class Search extends Viewlet {

    constructor(code: Code) {
        super(code);
    }

    public async openSearchViewlet(): Promise<any> {
        if (process.platform === "darwin") {
            await this.code.dispatchKeybinding("cmd+shift+f");
        } else {
            await this.code.dispatchKeybinding("ctrl+shift+f");
        }

        await this.waitForInputFocus(INPUT);
    }

    public async searchFor(text: string): Promise<void> {
        await this.waitForInputFocus(INPUT);
        await this.code.waitForSetValue(INPUT, text);
        await this.submitSearch();
    }

    public async submitSearch(): Promise<void> {
        await this.waitForInputFocus(INPUT);

        await this.code.dispatchKeybinding("enter");
        await this.code.waitForElement(`${VIEWLET} .messages`);
    }

    public async setFilesToIncludeText(text: string): Promise<void> {
        await this.waitForInputFocus(INCLUDE_INPUT);
        await this.code.waitForSetValue(INCLUDE_INPUT, text || "");
    }

    public async showQueryDetails(): Promise<void> {
        await this.code.waitAndClick(`${VIEWLET} .query-details .more`);
    }

    public async hideQueryDetails(): Promise<void> {
        await this.code.waitAndClick(`${VIEWLET} .query-details.more .more`);
    }

    public async removeFileMatch(filename: string): Promise<void> {
        const fileMatch = FILE_MATCH(filename);

        await retry(
            () => this.code.waitAndClick(fileMatch),
            async() => await executeWithSpecifiedPollRetryParameters(async() => await this.code.waitForElement(`${fileMatch} .action-label.codicon-search-remove`, el => !!el && el.top > 0 && el.left > 0), 10)
        );

        // ¯\_(ツ)_/¯
        await new Promise(c => setTimeout(c, 500));
        await this.code.waitAndClick(`${fileMatch} .action-label.codicon-search-remove`);
        await this.code.waitForElement(fileMatch, el => !el);
    }

    public async expandReplace(): Promise<void> {
        await this.code.waitAndClick(`${VIEWLET} .search-widget .monaco-button.toggle-replace-button.codicon-search-hide-replace`);
    }

    public async collapseReplace(): Promise<void> {
        await this.code.waitAndClick(`${VIEWLET} .search-widget .monaco-button.toggle-replace-button.codicon-search-show-replace`);
    }

    public async setReplaceText(text: string): Promise<void> {
        await this.code.waitForSetValue(`${VIEWLET} .search-widget .replace-container .monaco-inputbox textarea[title="Replace"]`, text);
    }

    public async replaceFileMatch(filename: string): Promise<void> {
        const fileMatch = FILE_MATCH(filename);

        await retry(
            () => this.code.waitAndClick(fileMatch),
            () => this.code.waitForElement(`${fileMatch} .action-label.codicon.codicon-search-replace-all`, el => !!el && el.top > 0 && el.left > 0, 10)
        );

        // ¯\_(ツ)_/¯
        await new Promise(c => setTimeout(c, 500));
        await this.code.waitAndClick(`${fileMatch} .action-label.codicon.codicon-search-replace-all`);
    }

    public async waitForResultText(text: string): Promise<void> {
        // The label can end with " - " depending on whether the search editor is enabled
        await this.code.waitForTextContent(`${VIEWLET} .messages .message>span`, undefined, result => result.startsWith(text));
    }

    public async waitForNoResultText(): Promise<void> {
        await this.code.waitForTextContent(`${VIEWLET} .messages`, "");
    }

    private async waitForInputFocus(selector: string): Promise<void> {
        let retries = 0;

        // other parts of code might steal focus away from input boxes :(
        while (retries < 5) {
            await this.code.waitAndClick(INPUT, 2, 2);

            try {
                await this.code.waitForActiveElement(INPUT, 10);
                break;
            } catch (err) {
                if (++retries > 5) {
                    throw err;
                }
            }
        }
    }
}
