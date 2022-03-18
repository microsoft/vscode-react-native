// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.

import * as assert from "assert";
import * as nls from "vscode-nls";
import * as vscode from "vscode";
import { ErrorHelper } from "../../common/error/errorHelper";
import { InternalErrorCode } from "../../common/error/internalErrorCode";
import { AdbHelper } from "../android/adb";
import { AndroidDeviceTracker } from "../android/androidDeviceTracker";
import { IOSDeviceTracker } from "../ios/iOSDeviceTracker";
import { OutputChannelLogger } from "../log/OutputChannelLogger";
import { NetworkInspectorServer } from "../networkInspector/networkInspectorServer";
import { CONTEXT_VARIABLES_NAMES } from "../../common/contextVariablesNames";
import { InspectorViewFactory } from "../networkInspector/views/inspectorViewFactory";
import { Command } from "./util/command";

nls.config({
    messageFormat: nls.MessageFormat.bundle,
    bundleFormat: nls.BundleFormat.standalone,
})();
const localize = nls.loadMessageBundle();

interface NetworkInspectorModule {
    networkInspector: NetworkInspectorServer;
    androidDeviceTracker: AndroidDeviceTracker;
    iOSDeviceTracker: IOSDeviceTracker | undefined;
}

// #todo!> commands should not maintain state
let networkInspectorModule: NetworkInspectorModule | undefined;

export class StartNetworkInspector extends Command {
    codeName = "startNetworkInspector";
    label = "Run Network Inspector";
    requiresTrust = false;
    error = ErrorHelper.getInternalError(InternalErrorCode.CouldNotStartNetworkInspector);

    async baseFn(): Promise<void> {
        assert(this.project);

        const logger = OutputChannelLogger.getMainChannel();

        if (networkInspectorModule) {
            logger.info(
                localize(
                    "AnotherNetworkInspectorAlreadyRun",
                    "Another Network inspector is already running",
                ),
            );
            return;
        }

        const adbHelper = new AdbHelper(
            this.project.getPackager().getProjectPath(),
            this.project.getOrUpdateNodeModulesRoot(),
        );
        const networkInspector = new NetworkInspectorServer();
        const androidDeviceTracker = new AndroidDeviceTracker(adbHelper);
        const iOSDeviceTracker =
            (process.platform === "darwin" && new IOSDeviceTracker()) || undefined;

        networkInspectorModule = {
            networkInspector,
            androidDeviceTracker,
            iOSDeviceTracker,
        };

        try {
            if (iOSDeviceTracker) {
                await iOSDeviceTracker.start();
            }
            await androidDeviceTracker.start();
            await networkInspector.start(adbHelper);
            void vscode.commands.executeCommand(
                "setContext",
                CONTEXT_VARIABLES_NAMES.IS_RNT_NETWORK_INSPECTOR_RUNNING,
                true,
            );
        } catch (err) {
            await stopNetworkInspector();
            throw err;
        }
    }
}

export class StopNetworkInspector extends Command {
    codeName = "stopNetworkInspector";
    label = "Stop Network Inspector";
    requiresTrust = false;
    error = ErrorHelper.getInternalError(InternalErrorCode.CouldNotStopNetworkInspector);

    async baseFn(): Promise<void> {
        await stopNetworkInspector();
    }
}

async function stopNetworkInspector() {
    networkInspectorModule?.androidDeviceTracker?.stop();
    networkInspectorModule?.iOSDeviceTracker?.stop();
    await networkInspectorModule?.networkInspector?.stop();
    networkInspectorModule = undefined;
    InspectorViewFactory.clearCache();
    void vscode.commands.executeCommand(
        "setContext",
        CONTEXT_VARIABLES_NAMES.IS_RNT_NETWORK_INSPECTOR_RUNNING,
        false,
    );
}
