// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.

import { SpectronApplication } from "../../spectron/application";
import { Viewlet } from "../workbench/viewlet";
import { sleep } from "../../helpers/setupEnvironmentHelper";
import * as clipboardy from "clipboardy";

const VIEWLET = "div[id=\"workbench.view.debug\"]";
const DEBUG_VIEW = `${VIEWLET} .debug-view-content`;
const DEBUG_OPTIONS_COMBOBOX = "select[aria-label=\"Debug Launch Configurations\"].monaco-select-box.monaco-select-box-dropdown-padding";
const DEBUG_OPTIONS_COMBOBOX_OPENED = "select[aria-label=\"Debug Launch Configurations\"].monaco-select-box.monaco-select-box-dropdown-padding.synthetic-focus";
const CONFIGURE = `div[id="workbench.parts.sidebar"] .actions-container .configure`;
const START = `.icon[title="Start Debugging"]`;
const STOP = `.debug-toolbar .debug-action.stop`;
const STEP_OVER = `.debug-toolbar .debug-action.step-over`;
const STEP_IN = `.debug-toolbar .debug-action.step-into`;
const STEP_OUT = `.debug-toolbar .debug-action.step-out`;
const CONTINUE = `.debug-toolbar .debug-action.continue`;
const GLYPH_AREA = ".margin-view-overlays>:nth-child";
const BREAKPOINT_GLYPH = ".debug-breakpoint";
// const PAUSE = `.debug-toolbar .debug-action.pause`;
const DEBUG_STATUS_BAR = `.statusbar.debugging`;
const NOT_DEBUG_STATUS_BAR = `.statusbar:not(debugging)`;
// const TOOLBAR_HIDDEN = `.debug-toolbar.monaco-builder-hidden`;
const STACK_FRAME = `${VIEWLET} .monaco-list-row .stack-frame`;
const VARIABLE = `${VIEWLET} .debug-variables .monaco-tree-row .expression`;
const CONSOLE_OUTPUT = `.repl .output.expression`;
const CONSOLE_INPUT_OUTPUT = `.repl .input-output-pair .output.expression .value`;

const REPL_FOCUSED = ".repl-input-wrapper .monaco-editor textarea";
const DEBUG_CONSOLE_AREA = ".repl .monaco-scrollable-element ";

export interface IStackFrame {
    id: string;
    name: string;
    lineNumber: number;
}

export class Debug extends Viewlet {

    constructor(spectron: SpectronApplication) {
        super(spectron);
    }

    public async openDebugViewlet(): Promise<any> {
        await this.spectron.runCommand("workbench.view.debug");
        await this.spectron.client.waitForElement(DEBUG_VIEW);
    }

    public async chooseDebugConfiguration(debugOption: string) {
        await this.spectron.client.waitAndClick(`${DEBUG_OPTIONS_COMBOBOX}`);
        await this.spectron.client.waitForElement(DEBUG_OPTIONS_COMBOBOX_OPENED);
        await this.spectron.client.waitAndClick(`${DEBUG_OPTIONS_COMBOBOX_OPENED} option[value=\"${debugOption}\"]`);
    }

    public async configure(): Promise<any> {
        await this.spectron.client.waitAndClick(CONFIGURE);
        await this.spectron.workbench.waitForEditorFocus("launch.json");
    }

    public async setBreakpointOnLine(lineNumber: number): Promise<any> {
        await this.spectron.client.waitForElement(`${GLYPH_AREA}(${lineNumber})`);
        await this.spectron.client.leftClick(`${GLYPH_AREA}(${lineNumber})`, 5, 5);
        await this.spectron.client.waitForElement(BREAKPOINT_GLYPH);
    }

    public async startDebugging(): Promise<void> {
        await this.spectron.client.waitAndClick(START);
    }

    public async waitForDebuggingToStart(): Promise<void> {
        await this.spectron.client.waitForElement(DEBUG_STATUS_BAR);
    }

    public async stepOver(): Promise<any> {
        await this.spectron.client.waitAndClick(STEP_OVER);
    }

    public async stepIn(): Promise<any> {
        await this.spectron.client.waitAndClick(STEP_IN);
    }

    public async stepOut(): Promise<any> {
        await this.spectron.client.waitAndClick(STEP_OUT);
    }

    public async continue(): Promise<any> {
        await this.spectron.client.waitAndClick(CONTINUE);
    }

    public async stopDebugging(): Promise<any> {
        await this.spectron.client.waitAndClick(STOP);
        await this.spectron.client.waitForElement(NOT_DEBUG_STATUS_BAR);
    }

    public async waitForStackFrame(func: (stackFrame: IStackFrame) => boolean, message: string): Promise<IStackFrame> {
        return await this.spectron.client.waitFor(async () => {
            const stackFrames = await this.getStackFrames();
            return stackFrames.filter(func)[0];
        }, void 0, `Waiting for Stack Frame: ${message}`);
    }

    public async waitForStackFrameLength(length: number): Promise<any> {
        return await this.spectron.client.waitFor(() => this.getStackFrames(), stackFrames => stackFrames.length === length);
    }

    public async focusStackFrame(name: string, message: string): Promise<any> {
        const stackFrame = await this.waitForStackFrame(sf => sf.name === name, message);
        await this.spectron.client.spectron.client.elementIdClick(stackFrame.id);
        await this.spectron.workbench.waitForTab(name);
    }

    public async waitForReplCommand(text: string, accept: (result: string) => boolean): Promise<void> {
        await this.spectron.workbench.quickopen.runCommand("Debug: Focus Debug Console");
        await this.spectron.client.waitForActiveElement(REPL_FOCUSED);
        await this.spectron.client.setValue(REPL_FOCUSED, text);

        // Wait for the keys to be picked up by the editor model such that repl evalutes what just got typed
        await this.spectron.workbench.editor.waitForEditorContents("debug:input", s => s.indexOf(text) >= 0);
        await this.spectron.client.keys(["Enter", "NULL"]);
        await this.spectron.client.waitForElement(CONSOLE_INPUT_OUTPUT);
        await this.spectron.client.waitFor(async () => {
            const result = await this.getConsoleOutput();
            return result[result.length - 1] || "";
        }, accept);
    }

    public async getLocalVariableCount(): Promise<number> {
        return await this.spectron.webclient.selectorExecute(VARIABLE, div => (Array.isArray(div) ? div : [div]).length);
    }

    public async getStackFramesLength(): Promise<number> {
        const stackFrames = await this.getStackFrames();
        return stackFrames.length;
    }

    public async focusDebugConsole() {
        await this.spectron.client.waitAndClick(DEBUG_CONSOLE_AREA);
        await sleep(300);
    }

    public async findStringInConsole(stringToFind: string, timeout: number): Promise<boolean> {
        let awaitRetries: number = timeout / 200;
        let retry = 1;
        await this.focusDebugConsole();
        let found;
        await new Promise((resolve) => {
            let check = setInterval(async () => {
                let result = await this.getConsoleOutput();
                let testOutputIndex = result.indexOf(stringToFind);
                if (testOutputIndex !== -1) {
                    clearInterval(check);
                    found = true;
                    resolve();
                } else {
                    retry++;
                    this.spectron.client.keys(["ArrowDown"]);
                    if (retry >= awaitRetries) {
                        clearInterval(check);
                        found = false;
                        resolve();
                    }
                }
            }, 200);
        });
        return found;
    }

    public async getConsoleOutput(): Promise<string[]> {
        const result = await this.spectron.webclient.selectorExecute(CONSOLE_OUTPUT,
            div => (Array.isArray(div) ? div : [div]).map(element => {
                const value = element.querySelector(".value") as HTMLElement;
                return value && value.textContent;
            }).filter(line => !!line)
        );

        return result;
    }

    // Gets Expo URL from VS Code Expo QR Code tab
    // For correct work opened and selected Expo QR Code tab is needed
    public async prepareExpoURLToClipboard() {
        await sleep(2000);
        this.spectron.runCommand("editor.action.webvieweditor.selectAll");
        console.log("Expo QR Code tab text prepared to be copied");
        await sleep(1000);
        this.spectron.runCommand("editor.action.clipboardCopyAction");
        await sleep(2000);
        let clipboard = clipboardy.readSync();
        console.log(`Expo QR Code tab text copied: \n ${clipboard}`);
        clipboard = clipboard.match(/^exp:\/\/\d+\.\d+\.\d+\.\d+\:\d+$/gm);
        if (!clipboard) return null;
        let expoURL = clipboard[0];
        console.log(`Found Expo URL: ${expoURL}`);
        return expoURL;
    }

    private async getStackFrames(): Promise<IStackFrame[]> {
        const result = await this.spectron.webclient.selectorExecute(STACK_FRAME,
            div => (Array.isArray(div) ? div : [div]).map(element => {
                const name = element.querySelector(".file-name") as HTMLElement;
                const line = element.querySelector(".line-number") as HTMLElement;
                const lineNumber = line.textContent ? parseInt(line.textContent.split(":").shift() || "0", 10) : 0;

                return {
                    name: name.textContent,
                    lineNumber,
                    element,
                };
            })
        );

        if (!Array.isArray(result)) {
            return [];
        }

        return result
            .map(({ name, lineNumber, element }) => ({ name, lineNumber, id: element.ELEMENT }));
    }

}
