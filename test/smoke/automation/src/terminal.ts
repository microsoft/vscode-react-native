// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.

import { Code } from "./code";
import { QuickAccess } from "./quickaccess";

const PANEL_SELECTOR = "div[id=\"workbench.panel.terminal\"]";
const XTERM_SELECTOR = `${PANEL_SELECTOR} .terminal-wrapper`;
const XTERM_TEXTAREA = `${XTERM_SELECTOR} textarea.xterm-helper-textarea`;

export class Terminal {

    constructor(private code: Code, private quickaccess: QuickAccess) { }

    public async showTerminal(): Promise<void> {
        await this.quickaccess.runCommand("workbench.action.terminal.toggleTerminal");
        await this.code.waitForActiveElement(XTERM_TEXTAREA);
        await this.code.waitForTerminalBuffer(XTERM_SELECTOR, lines => lines.some(line => line.length > 0));
    }

    public async showTerminalWithoutNecessaryFocus(): Promise<void> {
        await this.quickaccess.runCommand("workbench.action.terminal.toggleTerminal");
        await new Promise(c => setTimeout(c, 2000));
    }

    public async runCommand(commandText: string): Promise<void> {
        await this.code.writeInTerminal(XTERM_SELECTOR, commandText);
        // hold your horses
        await new Promise(c => setTimeout(c, 500));
        await this.code.dispatchKeybinding("enter");
    }

    public async waitForTerminalText(accept: (buffer: string[]) => boolean): Promise<void> {
        await this.code.waitForTerminalBuffer(XTERM_SELECTOR, accept);
    }
}
