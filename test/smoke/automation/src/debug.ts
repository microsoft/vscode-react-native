// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.

import { Viewlet } from "./viewlet";
import { Commands } from "./workbench";
import { Code, findElement, sleep } from "./code";
import { Editors } from "./editors";
import { Editor } from "./editor";
import { IElement } from "../src/driver";
import * as clipboardy from "clipboardy";
import { QuickOpen } from ".";

const VIEWLET = "div[id=\"workbench.view.debug\"]";
const DEBUG_VIEW = `${VIEWLET} .debug-view-content`;
const CONFIGURE = `div[id="workbench.parts.sidebar"] .actions-container .configure`;
const STOP = `.debug-toolbar .action-label[title*="Stop"]`;
const STEP_OVER = `.debug-toolbar .action-label[title*="Step Over"]`;
const STEP_IN = `.debug-toolbar .action-label[title*="Step Into"]`;
const STEP_OUT = `.debug-toolbar .action-label[title*="Step Out"]`;
const CONTINUE = `.debug-toolbar .action-label[title*="Continue"]`;
const DISCONNECT = `.debug-toolbar .action-label[title*="Disconnect"]`;
const GLYPH_AREA = ".margin-view-overlays>:nth-child";
const BREAKPOINT_GLYPH = ".debug-breakpoint";
const DEBUG_STATUS_BAR = `.statusbar.debugging`;
const NOT_DEBUG_STATUS_BAR = `.statusbar:not(debugging)`;
const TOOLBAR_HIDDEN = `.debug-toolbar[aria-hidden="true"]`;
const STACK_FRAME = `${VIEWLET} .monaco-list-row .stack-frame`;
const SPECIFIC_STACK_FRAME = (filename: string) => `${STACK_FRAME} .file[title*="${filename}"]`;
const VARIABLE = `${VIEWLET} .debug-variables .monaco-list-row .expression`;
const CONSOLE_OUTPUT = `.repl .output.expression .value`;
const CONSOLE_EVALUATION_RESULT = `.repl .evaluation-result.expression .value`;
const CONSOLE_LINK = `.repl .value a.link`;
const OUTPUT_CHANNEL = `div[id="workbench.panel.output"] .view-line`;

const REPL_FOCUSED = ".repl-input-wrapper .monaco-editor textarea";

export interface IStackFrame {
    name: string;
    lineNumber: number;
}

function toStackFrame(element: IElement): IStackFrame {
    const name = findElement(element, e => /\bfile-name\b/.test(e.className))!;
    const line = findElement(element, e => /\bline-number\b/.test(e.className))!;
    const lineNumber = line.textContent ? parseInt(line.textContent.split(":").shift() || "0") : 0;

    return {
        name: name.textContent || "",
        lineNumber,
    };
}

export class Debug extends Viewlet {

    constructor(code: Code, private commands: Commands, private editors: Editors, private editor: Editor, private quickopen: QuickOpen) {
        super(code);
    }

    public async openDebugViewlet(): Promise<any> {
        if (process.platform === "darwin") {
            await this.code.dispatchKeybinding("cmd+shift+d");
        } else {
            await this.code.dispatchKeybinding("ctrl+shift+d");
        }

        await this.code.waitForElement(DEBUG_VIEW);
    }

    public async configure(): Promise<any> {
        await this.code.waitAndClick(CONFIGURE);
        await this.editors.waitForEditorFocus("launch.json");
    }

    public async setBreakpointOnLine(lineNumber: number): Promise<any> {
        await this.code.waitForElement(`${GLYPH_AREA}(${lineNumber})`);
        await this.code.waitAndClick(`${GLYPH_AREA}(${lineNumber})`, 5, 5);
        await this.code.waitForElement(BREAKPOINT_GLYPH);
    }

    public async startDebugging(): Promise<void> {
        await this.code.dispatchKeybinding("f5");
    }

    public async waitForDebuggingToStart(): Promise<void> {
        await this.code.waitForElement(DEBUG_STATUS_BAR);
    }

    public async areStackFramesExist(): Promise<any> {
        return await this.code.waitForElement(STACK_FRAME);
    }

    public async runDebugScenario(debugOption: string): Promise<any> {
        await this.quickopen.openQuickOpen();
        await this.quickopen.submit(`debug ${debugOption}`);
    }

    public async stepOver(): Promise<any> {
        await this.code.waitAndClick(STEP_OVER);
    }

    public async stepIn(): Promise<any> {
        await this.code.waitAndClick(STEP_IN);
    }

    public async stepOut(): Promise<any> {
        await this.code.waitAndClick(STEP_OUT);
    }

    public async continue(): Promise<any> {
        await this.code.waitAndClick(CONTINUE);
        await this.waitForStackFrameLength(0);
    }

    public async stopDebugging(): Promise<any> {
        await this.code.waitAndClick(STOP);
        await this.code.waitForElement(TOOLBAR_HIDDEN);
        await this.code.waitForElement(NOT_DEBUG_STATUS_BAR);
    }

    public async disconnectFromDebugger(): Promise<any> {
        await this.code.waitAndClick(DISCONNECT);
        await this.code.waitForElement(TOOLBAR_HIDDEN);
        await this.code.waitForElement(NOT_DEBUG_STATUS_BAR);
    }

    public async waitForStackFrame(func: (stackFrame: IStackFrame) => boolean, message: string): Promise<IStackFrame> {
        const elements = await this.code.waitForElements(STACK_FRAME, true, elements => elements.some(e => func(toStackFrame(e))));
        return elements.map(toStackFrame).filter(s => func(s))[0];
    }

    public async waitForStackFrameLength(length: number): Promise<any> {
        await this.code.waitForElements(STACK_FRAME, false, result => result.length === length);
    }

    public async focusStackFrame(name: string, message: string): Promise<any> {
        await this.code.waitAndClick(SPECIFIC_STACK_FRAME(name), 0, 0);
        await this.editors.waitForTab(name);
    }

    public async waitForReplCommand(text: string, accept: (result: string) => boolean): Promise<void> {
        await this.commands.runCommand("Debug: Focus on Debug Console View");
        await this.code.waitForActiveElement(REPL_FOCUSED);
        await this.code.waitForSetValue(REPL_FOCUSED, text);

        // Wait for the keys to be picked up by the editor model such that repl evalutes what just got typed
        await this.editor.waitForEditorContents("debug:replinput", s => s.indexOf(text) >= 0);
        await this.code.dispatchKeybinding("enter");
        await this.code.waitForElements(CONSOLE_EVALUATION_RESULT, false,
            elements => !!elements.length && accept(elements[elements.length - 1].textContent));
    }

    // Different node versions give different number of variables. As a workaround be more relaxed when checking for variable count
    public async waitForVariableCount(count: number, alternativeCount: number): Promise<void> {
        await this.code.waitForElements(VARIABLE, false, els => els.length === count || els.length === alternativeCount);
    }

    public async waitForLink(): Promise<void> {
        await this.code.waitForElement(CONSOLE_LINK);
    }

    public async waitForOutput(fn: (output: string[]) => boolean): Promise<string[]> {
        const elements = await this.code.waitForElements(CONSOLE_OUTPUT, false, elements => fn(elements.map(e => e.textContent)));
        return elements.map(e => e.textContent);
    }

    public async getOutputChannelContent(fn: (output: string[]) => boolean): Promise<string[]> {
        const elements = await this.code.waitForElements(OUTPUT_CHANNEL, false, elements => fn(elements.map(e => e.textContent)));
        return elements.map(e => e.textContent);
    }

    // Gets Expo URL from VS Code Expo QR Code tab
    // For correct work opened and selected Expo QR Code tab is needed
    public async prepareExpoURLToClipboard() {
        this.quickopen.openQuickOpen();
        this.quickopen.submit("React Native: Run exponent");
        let expoURL = null;
        this.getOutputChannelContent(output => output.some(line => {
            let match = line.match(/^exp:\/\/\d+\.\d+\.\d+\.\d+\:\d+$/gm);
            if (match) {
                expoURL = match[0];
                clipboardy.writeSync(expoURL);
                console.log(`Found Expo URL: ${expoURL}`);
                return true;
            }
            return false;
        }));
        return expoURL;
    }
}
