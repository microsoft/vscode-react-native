// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.

import { Explorer } from "./explorer";
import { ActivityBar } from "./activityBar";
import { QuickOpen } from "./quickopen";
import { QuickInput } from "./quickinput";
import { Extensions } from "./extensions";
import { Search } from "./search";
import { Editor } from "./editor";
import { SCM } from "./scm";
import { Debug } from "./debug";
import { StatusBar } from "./statusbar";
import { Problems } from "./problems";
import { SettingsEditor } from "./settings";
import { KeybindingsEditor } from "./keybindings";
import { Editors } from "./editors";
import { Code } from "./code";
import { Terminal } from "./terminal";

export interface Commands {
    runCommand(command: string): Promise<any>;
}

export class Workbench {

    public readonly quickopen: QuickOpen;
    public readonly quickinput: QuickInput;
    public readonly editors: Editors;
    public readonly explorer: Explorer;
    public readonly activitybar: ActivityBar;
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

    constructor(code: Code, userDataPath: string) {
        this.editors = new Editors(code);
        this.quickopen = new QuickOpen(code, this.editors);
        this.quickinput = new QuickInput(code);
        this.explorer = new Explorer(code, this.editors);
        this.activitybar = new ActivityBar(code);
        this.search = new Search(code);
        this.extensions = new Extensions(code);
        this.editor = new Editor(code, this.quickopen);
        this.scm = new SCM(code);
        this.debug = new Debug(code, this.quickopen, this.editors, this.editor);
        this.statusbar = new StatusBar(code);
        this.problems = new Problems(code);
        this.settingsEditor = new SettingsEditor(code, userDataPath, this.editors, this.editor, this.quickopen);
        this.keybindingsEditor = new KeybindingsEditor(code);
        this.terminal = new Terminal(code, this.quickopen);
    }
}
