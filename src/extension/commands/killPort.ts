// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.

import * as assert from "assert";
import * as vscode from "vscode";
import { ErrorHelper } from "../../common/error/errorHelper";
import { InternalErrorCode } from "../../common/error/internalErrorCode";
import { ChildProcess } from "../../common/node/childProcess";
import { OutputChannelLogger } from "../log/OutputChannelLogger";
import { ReactNativeCommand } from "./util/reactNativeCommand";
import { wait } from "../../common/utils";

const logger = OutputChannelLogger.getMainChannel();
export class killPort extends ReactNativeCommand {
    codeName = "killPort";
    label = "Kill Port";
    error = ErrorHelper.getInternalError(InternalErrorCode.FailedToKillPort);

    async baseFn(): Promise<void> {
        assert(this.project);
        await wait();
        await vscode.window
            .showInputBox({ placeHolder: "please enter the port you want to kill" })
            .then(async value => {
                if (value) {
                    const res = await new ChildProcess().exec(`npx kill-port ${value}`);
                    logger.info(`killing port ${value}, it may take a while...`);
                    const outcome = await res.outcome;
                    logger.info(outcome);
                }
            });
    }
}
