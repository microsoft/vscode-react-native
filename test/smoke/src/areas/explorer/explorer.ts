// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.

import { SpectronApplication } from "../../spectron/application";
import { Viewlet } from "../workbench/viewlet";


export class Explorer extends Viewlet {

    private static readonly EXPLORER_VIEWLET = "div[id=\"workbench.view.explorer\"]";
    private static readonly OPEN_EDITORS_VIEW = `${Explorer.EXPLORER_VIEWLET} .split-view-view:nth-child(1) .title`;
    private static readonly OUTLINE_VIEW_EXPANDED = `${Explorer.EXPLORER_VIEWLET} .split-view-view:nth-child(3) .expanded .title`;
    private static readonly OUTLINE_VIEW = `${Explorer.EXPLORER_VIEWLET} .split-view-view:nth-child(3) .title`;

    constructor(spectron: SpectronApplication) {
        super(spectron);
    }

    public openExplorerView(): Promise<any> {
        return this.spectron.runCommand("workbench.view.explorer");
    }

    public getOpenEditorsViewTitle(): Promise<string> {
        return this.spectron.client.waitForText(Explorer.OPEN_EDITORS_VIEW);
    }

    public async openFile(fileName: string): Promise<any> {
        await this.spectron.client.doubleClickAndWait(`div[class*="monaco-icon-label file-icon ${fileName.toLowerCase()}-name-file-icon ${this.getExtensionSelector(fileName.toLowerCase())} explorer-item"]`);
        await this.spectron.workbench.waitForEditorFocus(fileName);
    }

    public getExtensionSelector(fileName: string): string {
        const extension = fileName.split(".")[1];
        if (extension === "js") {
            return "js-ext-file-icon ext-file-icon javascript-lang-file-icon";
        } else if (extension === "json") {
            return "json-ext-file-icon ext-file-icon json-lang-file-icon";
        } else if (extension === "md") {
            return "md-ext-file-icon ext-file-icon markdown-lang-file-icon";
        }
        throw new Error("No class defined for this file extension");
    }

    public async collapseOutlineView() {
        await this.spectron.client.waitForElement(Explorer.OUTLINE_VIEW);
        if (await this.spectron.webclient.isExisting(Explorer.OUTLINE_VIEW_EXPANDED)) {
            await this.spectron.client.click(Explorer.OUTLINE_VIEW_EXPANDED);
        }
    }
}