// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.

import * as assert from "assert";
import * as vscode from "vscode";
import { ErrorHelper } from "../../common/error/errorHelper";
import { InternalErrorCode } from "../../common/error/internalErrorCode";
import { LogCatMonitorManager } from "../android/logCatMonitorManager";
import { OutputChannelLogger } from "../log/OutputChannelLogger";
import { Command } from "./util/command";

export class StopLogCatMonitor extends Command {
    codeName = "stopLogCatMonitor";
    label = "Stop React Native LogCat Monitor";

    requiresTrust = false;
    requiresProject = false;
    error = ErrorHelper.getInternalError(InternalErrorCode.AndroidCouldNotStopLogCatMonitor);

    async baseFn() {
        const monitor = await selectLogCatMonitor();
        LogCatMonitorManager.delMonitor(monitor.deviceId);
    }
}

function selectLogCatMonitor() {
    const logger = OutputChannelLogger.getMainChannel();
    const keys = Object.keys(LogCatMonitorManager.logCatMonitorsCache);

    if (keys.length === 1) {
        logger.debug(`Command palette: once LogCat monitor ${keys[0]}`);
        return LogCatMonitorManager.logCatMonitorsCache[keys[0]];
    }

    if (keys.length > 1) {
        return new Promise(vscode.window.showQuickPick(keys).then).then(selected => {
            assert(selected, "Selection canceled");
            logger.debug(`Command palette: selected LogCat monitor ${selected}`);
            return LogCatMonitorManager.logCatMonitorsCache[selected];
        });
    }

    throw ErrorHelper.getInternalError(InternalErrorCode.AndroidCouldNotFindActiveLogCatMonitor);
}
