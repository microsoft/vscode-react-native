// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.

import { Code } from "./code";

export class Editors {

    constructor(private code: Code) { }

    public async saveOpenedFile(): Promise<any> {
        if (process.platform === "darwin") {
            await this.code.dispatchKeybinding("cmd+s");
        } else {
            await this.code.dispatchKeybinding("ctrl+s");
        }
    }

    public async selectTab(tabName: string, untitled: boolean = false): Promise<void> {
        await this.code.waitAndClick(`.tabs-container div.tab[aria-label="${tabName}, tab"]`);
        await this.waitForEditorFocus(tabName, untitled);
    }

    public async waitForActiveEditor(filename: string): Promise<any> {
        const selector = `.editor-instance .monaco-editor[data-uri$="${filename}"] textarea`;
        return this.code.waitForActiveElement(selector);
    }

    public async waitForEditorFocus(fileName: string, untitled: boolean = false): Promise<void> {
        await this.waitForActiveTab(fileName);
        await this.waitForActiveEditor(fileName);
    }

    public async waitForActiveTab(fileName: string, isDirty: boolean = false): Promise<void> {
        await this.code.waitForElement(`.tabs-container div.tab.active${isDirty ? ".dirty" : ""}[aria-selected="true"][aria-label="${fileName}, tab"]`);
    }

    public async waitForTab(fileName: string, isDirty: boolean = false): Promise<void> {
        await this.code.waitForElement(`.tabs-container div.tab${isDirty ? ".dirty" : ""}[aria-label="${fileName}, tab"]`);
    }

    public async newUntitledFile(): Promise<void> {
        if (process.platform === "darwin") {
            await this.code.dispatchKeybinding("cmd+n");
        } else {
            await this.code.dispatchKeybinding("ctrl+n");
        }

        await this.waitForEditorFocus("Untitled-1", true);
    }
}
