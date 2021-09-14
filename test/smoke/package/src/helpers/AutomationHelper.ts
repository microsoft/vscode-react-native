// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.

import { Application } from "../../../automation";
import { SmokeTestsConstants } from "./smokeTestsConstants";

export interface IStackFrame {
    name: string;
    lineNumber: number;
}

const DISCONNECT = `.debug-toolbar .action-label[title*="Disconnect"]`;
const TOOLBAR_HIDDEN = `.debug-toolbar[aria-hidden="true"]`;
const NOT_DEBUG_STATUS_BAR = `.statusbar:not(debugging)`;
const STOP = `.debug-toolbar .action-label[title*="Stop"]`;

export default class AutomationHelper {
    constructor(private app: Application) {}

    private async retryWithSpecifiedPollRetryParameters(
        fun: () => Promise<any>,
        retryCount: number,
        pollRetryCount: number = 2000,
        pollRetryInterval: number = 100,
        catchFun?: () => Promise<any>,
    ): Promise<any> {
        let tryes = retryCount;
        while (tryes > 0) {
            try {
                return await this.app.workbench.code.executeWithSpecifiedPollRetryParameters(
                    fun,
                    pollRetryCount,
                    pollRetryInterval,
                );
            } catch (e) {
                if (catchFun) {
                    await catchFun();
                }
                tryes--;
                if (tryes === 0) {
                    throw e;
                }
            }
        }
    }

    public async openFileWithRetry(
        fileName: string,
        retryCount: number = 3,
        pollRetryCount: number = 3,
        pollRetryInterval: number = 1000,
    ): Promise<void> {
        const fun = async () => await this.app.workbench.quickaccess.openFile(fileName);
        const catchFun = async () => await this.app.workbench.code.dispatchKeybinding("escape");
        await this.retryWithSpecifiedPollRetryParameters(
            fun,
            retryCount,
            pollRetryCount,
            pollRetryInterval,
            catchFun,
        );
    }

    public async runCommandWithRetry(
        commandId: string,
        retryCount: number = 3,
        pollRetryCount: number = 3,
        pollRetryInterval: number = 1000,
    ): Promise<void> {
        const fun = async () => await this.app.workbench.quickaccess.runCommand(commandId);
        const catchFun = async () => await this.app.workbench.code.dispatchKeybinding("escape");
        await this.retryWithSpecifiedPollRetryParameters(
            fun,
            retryCount,
            pollRetryCount,
            pollRetryInterval,
            catchFun,
        );
    }

    public async waitForOutputWithRetry(
        string: string,
        retryCount: number = 2,
        pollRetryCount: number = 100,
        pollRetryInterval: number = 100,
    ): Promise<boolean> {
        const fun = async () =>
            await this.app.workbench.debug.waitForOutput(output =>
                output.some(line => line.indexOf(string) >= 0),
            );
        const catchFun = async () => await this.app.workbench.debug.stepOver();
        return this.retryWithSpecifiedPollRetryParameters(
            fun,
            retryCount,
            pollRetryCount,
            pollRetryInterval,
            catchFun,
        );
    }

    public async runDebugScenarioWithRetry(
        scenario: string,
        index: number = 0,
        retryCount: number = 3,
        pollRetryCount: number = 30,
        pollRetryInterval: number = 1000,
    ): Promise<void> {
        const fun = async () => {
            await this.app.workbench.quickaccess.runDebugScenario(scenario, index);
            await this.app.workbench.debug.waitForDebugToolbarExist();
        };
        const catchFun = async () => await this.app.workbench.code.dispatchKeybinding("escape");
        await this.retryWithSpecifiedPollRetryParameters(
            fun,
            retryCount,
            pollRetryCount,
            pollRetryInterval,
            catchFun,
        );
    }

    public async waitForStackFrameWithRetry(
        func: (stackFrame: IStackFrame) => boolean,
        message: string,
        retryCount: number = 3,
        pollRetryCount: number = 30,
        pollRetryInterval: number = 1000,
        beforeWaitForStackFrame?: () => Promise<any>,
    ): Promise<void> {
        const fun = async () => {
            if (beforeWaitForStackFrame) {
                await beforeWaitForStackFrame();
            }
            // We cant find stack frame if Debug viewlet did not opened
            await this.app.workbench.debug.openDebugViewlet();
            let stackFrame: IStackFrame | undefined = undefined;
            try {
                await this.app.workbench.debug.waitForStackFrame((sf: IStackFrame) => {
                    stackFrame = sf;
                    return func(sf);
                }, message);
            } catch (error) {
                // Sometimes, when you start debugging,
                // the first breakpoint is triggered in some other 'js' file
                // that is not related to the testing project.
                // Click 'continue' to workaround this error.
                if (stackFrame && !func(stackFrame)) {
                    await this.app.workbench.debug.continue();
                }
                await this.app.workbench.debug.waitForStackFrame((sf: IStackFrame) => {
                    return func(sf);
                }, message);
            }
        };
        const catchFun = async () => {
            await this.runCommandWithRetry(SmokeTestsConstants.reloadAppCommand);
        };
        await this.retryWithSpecifiedPollRetryParameters(
            fun,
            retryCount,
            pollRetryCount,
            pollRetryInterval,
            catchFun,
        );
    }

    public async disconnectFromDebuggerWithRetry(
        retryCount: number = 3,
        pollRetryCount: number = 10,
        pollRetryInterval: number = 1000,
    ): Promise<void> {
        const fun = async () => {
            try {
                await Promise.race([
                    this.app.workbench.code.waitAndClick(DISCONNECT),
                    this.app.workbench.code.waitAndClick(STOP),
                ]);
            } catch (e) {}
            await this.app.workbench.code.waitForElement(TOOLBAR_HIDDEN);
            await this.app.workbench.code.waitForElement(NOT_DEBUG_STATUS_BAR);
        };
        await this.retryWithSpecifiedPollRetryParameters(
            fun,
            retryCount,
            pollRetryCount,
            pollRetryInterval,
        );
    }

    public async stopDebuggingWithRetry(
        retryCount: number = 3,
        pollRetryCount: number = 10,
        pollRetryInterval: number = 1000,
    ): Promise<void> {
        const fun = async () => {
            await this.app.workbench.code.waitAndClick(STOP);
            await this.app.workbench.code.waitForElement(TOOLBAR_HIDDEN);
            await this.app.workbench.code.waitForElement(NOT_DEBUG_STATUS_BAR);
        };
        await this.retryWithSpecifiedPollRetryParameters(
            fun,
            retryCount,
            pollRetryCount,
            pollRetryInterval,
        );
    }

    public async prepareForDebugScenarioCreactionTestWithRetry(
        retryCount: number = 3,
        pollRetryCount: number = 10,
        pollRetryInterval: number = 1000,
    ): Promise<void> {
        const fun = async () => {
            await this.app.workbench.debug.openDebugViewlet();
            await this.app.workbench.debug.configure();
            await this.app.workbench.terminal.showTerminalWithoutNecessaryFocus();
        };
        const catchFun = async () => await this.app.workbench.code.dispatchKeybinding("escape");
        await this.retryWithSpecifiedPollRetryParameters(
            fun,
            retryCount,
            pollRetryCount,
            pollRetryInterval,
            catchFun,
        );
    }

    public async addConfigurationWithRetry(
        retryCount: number = 3,
        pollRetryCount: number = 10,
        pollRetryInterval: number = 1000,
    ): Promise<void> {
        const fun = async () => {
            await this.app.workbench.debug.addConfiguration();
            await this.app.workbench.quickinput.waitForQuickInputOpened(pollRetryCount);
        };
        await this.retryWithSpecifiedPollRetryParameters(
            fun,
            retryCount,
            pollRetryCount,
            pollRetryInterval,
        );
    }
}
