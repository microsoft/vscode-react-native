// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.

import { SpectronApplication } from "../../spectron/application";
import { Explorer } from "../explorer/explorer";
import { ActivityBar } from "../activitybar/activityBar";
import { QuickOpen } from "../quickopen/quickopen";
import { Extensions } from "../extensions/extensions";
import { Search } from "../search/search";
import { Editor } from "../editor/editor";
import { SCM } from "../git/scm";
import { Debug } from "../debug/debug";
import { StatusBar } from "../statusbar/statusbar";
import { Problems } from "../problems/problems";
import { SettingsEditor } from "../preferences/settings";
import { KeybindingsEditor } from "../preferences/keybindings";
import { Terminal } from "../terminal/terminal";

export class Workbench {

    public readonly explorer: Explorer;
    public readonly activitybar: ActivityBar;
    public readonly quickopen: QuickOpen;
    public readonly search: Search;
    public readonly extensions: Extensions;
    public readonly editor: Editor;
    public readonly scm: SCM;
    public readonly debug: Debug;
    public readonly statusbar: StatusBar;
    public readonly problems: Problems;
    public readonly settingsEditor: SettingsEditor;
    public readonly keybindingsEditor: KeybindingsEditor;
    public readonly terminal: Terminal;

    constructor(private spectron: SpectronApplication) {
        this.explorer = new Explorer(spectron);
        this.activitybar = new ActivityBar(spectron);
        this.quickopen = new QuickOpen(spectron);
        this.search = new Search(spectron);
        this.extensions = new Extensions(spectron);
        this.editor = new Editor(spectron);
        this.scm = new SCM(spectron);
        this.debug = new Debug(spectron);
        this.statusbar = new StatusBar(spectron);
        this.problems = new Problems(spectron);
        this.settingsEditor = new SettingsEditor(spectron);
        this.keybindingsEditor = new KeybindingsEditor(spectron);
        this.terminal = new Terminal(spectron);
    }

    public async saveOpenedFile(): Promise<any> {
        await this.spectron.client.waitForElement(".tabs-container div.tab.active.dirty");
        await this.spectron.workbench.quickopen.runCommand("File: Save");
    }

    public async selectTab(tabName: string, untitled: boolean = false): Promise<void> {
        await this.spectron.client.waitAndClick(`.tabs-container div.tab[aria-label="${tabName}, tab"]`);
        await this.waitForEditorFocus(tabName, untitled);
    }

    public async waitForEditorFocus(fileName: string, untitled: boolean = false): Promise<void> {
        await this.waitForActiveTab(fileName);
        await this.editor.waitForActiveEditor(fileName);
    }

    public async waitForActiveTab(fileName: string, isDirty: boolean = false): Promise<any> {
        return this.spectron.client.waitForElement(`.tabs-container div.tab.active${isDirty ? ".dirty" : ""}[aria-selected="true"][aria-label="${fileName}, tab"]`);
    }

    public async waitForTab(fileName: string, isDirty: boolean = false): Promise<boolean> {
        return this.spectron.client.waitForElement(`.tabs-container div.tab${isDirty ? ".dirty" : ""}[aria-label="${fileName}, tab"]`).then(() => true);
    }

    public async newUntitledFile(): Promise<void> {
        await this.spectron.runCommand("workbench.action.files.newUntitledFile");
        await this.waitForEditorFocus("Untitled-1", true);
    }
}
