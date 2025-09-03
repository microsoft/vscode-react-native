// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.

import * as fs from "fs";
import * as path from "path";
import { Editor } from "./editor";
import { Editors } from "./editors";
import { Code } from "./code";
import { QuickAccess } from "./quickaccess";

export class SettingsEditor {
    constructor(
        private code: Code,
        private userDataPath: string,
        private editors: Editors,
        private editor: Editor,
        private quickaccess: QuickAccess,
    ) {}

    async addUserSetting(setting: string, value: string): Promise<void> {
        await this.openSettings();
        await this.editor.waitForEditorFocus("settings.json", 1);

        await this.code.dispatchKeybinding("right");
        await this.editor.waitForTypeInEditor("settings.json", `"${setting}": ${value},`);
        await this.editors.saveOpenedFile();
    }

    async clearUserSettings(): Promise<void> {
        const settingsPath = path.join(this.userDataPath, "User", "settings.json");
        await new Promise<void>((c, e) =>
            fs.writeFile(settingsPath, "{\n}", "utf8", err => (err ? e(err) : c())),
        );

        await this.openSettings();
        await this.editor.waitForEditorContents("settings.json", c => c === "{}");
    }

    private async openSettings(): Promise<void> {
        await this.quickaccess.runCommand("workbench.action.openSettingsJson");
    }
}
