// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.

import { Application } from "../../../automation";
import { SmokeTestsConstants } from "./smokeTestsConstants";

export interface IStackFrame {
    name: string;
    lineNumber: number;
}

export default class AutomationHelper {
    constructor(private app: Application) {}

    private async retryWithSpecifiedPollRetryParameters(
        fun: () => Promise<any>,
        catchFun: () => Promise<any>,
        retryCount: number,
        pollRetryCount: number = 2000,
        pollRetryInterval: number = 100,
    ): Promise<void> {
        let tryes = retryCount;
        while (tryes > 0) {
            try {
                await this.app.workbench.code.executeWithSpecifiedPollRetryParameters(
                    fun,
                    pollRetryCount,
                    pollRetryInterval,
                );
                break;
            } catch (e) {
                await catchFun();
                tryes--;
            }
        }
    }

    public async openFileWithRetry(
        fileName: string,
        retryCount: number = 5,
        pollRetryCount: number = 10,
        pollRetryInterval: number = 1000,
    ): Promise<any> {
        const fun = async () => await this.app.workbench.quickaccess.openFile(fileName);
        const catchFun = async () => await this.app.workbench.code.dispatchKeybinding("escape");
        await this.retryWithSpecifiedPollRetryParameters(
            fun,
            catchFun,
            retryCount,
            pollRetryCount,
            pollRetryInterval,
        );
    }

    public async runCommandWithRetry(
        commandId: string,
        retryCount: number = 5,
        pollRetryCount: number = 10,
        pollRetryInterval: number = 1000,
    ): Promise<any> {
        const fun = async () => await this.app.workbench.quickaccess.runCommand(commandId);
        const catchFun = async () => await this.app.workbench.code.dispatchKeybinding("escape");
        await this.retryWithSpecifiedPollRetryParameters(
            fun,
            catchFun,
            retryCount,
            pollRetryCount,
            pollRetryInterval,
        );
    }

    public async runDebugScenarioWithRetry(
        scenario: string,
        index: number = 0,
        retryCount: number = 5,
        pollRetryCount: number = 30,
        pollRetryInterval: number = 1000,
    ): Promise<any> {
        const fun = async () => {
            await this.app.workbench.quickaccess.runDebugScenario(scenario, index);
            await this.app.workbench.debug.waitForDebugToolbarExist();
        };
        const catchFun = async () => await this.app.workbench.code.dispatchKeybinding("escape");
        await this.retryWithSpecifiedPollRetryParameters(
            fun,
            catchFun,
            retryCount,
            pollRetryCount,
            pollRetryInterval,
        );
    }

    public async waitForStackFrameWithRetry(
        func: (stackFrame: IStackFrame) => boolean,
        message: string,
        retryCount: number = 5,
        pollRetryCount: number = 60,
        pollRetryInterval: number = 1000,
    ): Promise<any> {
        const fun = async () => await this.app.workbench.debug.waitForStackFrame(func, message);
        const catchFun = async () =>
            await this.runCommandWithRetry(SmokeTestsConstants.reloadAppCommand);
        await this.retryWithSpecifiedPollRetryParameters(
            fun,
            catchFun,
            retryCount,
            pollRetryCount,
            pollRetryInterval,
        );
    }
}
