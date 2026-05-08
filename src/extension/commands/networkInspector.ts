// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.

import assert = require("assert");
import * as nls from "vscode-nls";
import { ErrorHelper } from "../../common/error/errorHelper";
import { InternalErrorCode } from "../../common/error/internalErrorCode";
import { OutputChannelLogger } from "../log/OutputChannelLogger";
import { Command } from "./util/command";
import { NetworkInspectorManager } from "./networkInspectorManager";

nls.config({
    messageFormat: nls.MessageFormat.bundle,
    bundleFormat: nls.BundleFormat.standalone,
})();
const localize = nls.loadMessageBundle();

// Singleton instance of the Network Inspector Manager
const inspectorManager = new NetworkInspectorManager();

export class StartNetworkInspector extends Command {
    codeName = "startNetworkInspector";
    label = "Run Network Inspector";
    requiresTrust = false;
    error = ErrorHelper.getInternalError(InternalErrorCode.CouldNotStartNetworkInspector);

    async baseFn(): Promise<void> {
        assert(this.project);

        const logger = OutputChannelLogger.getMainChannel();

        if (inspectorManager.isRunning()) {
            logger.info(
                localize(
                    "AnotherNetworkInspectorAlreadyRun",
                    "Another Network inspector is already running",
                ),
            );
            return;
        }

        await inspectorManager.start(this.project);
    }
}

export class StopNetworkInspector extends Command {
    codeName = "stopNetworkInspector";
    label = "Stop Network Inspector";
    requiresTrust = false;
    error = ErrorHelper.getInternalError(InternalErrorCode.CouldNotStopNetworkInspector);

    async baseFn(): Promise<void> {
        await inspectorManager.stop();
    }
}
