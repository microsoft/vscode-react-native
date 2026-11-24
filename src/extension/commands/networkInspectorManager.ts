// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.

import * as vscode from "vscode";
import { AdbHelper } from "../android/adb";
import { AndroidDeviceTracker } from "../android/androidDeviceTracker";
import { IOSDeviceTracker } from "../ios/iOSDeviceTracker";
import { NetworkInspectorServer } from "../networkInspector/networkInspectorServer";
import { CONTEXT_VARIABLES_NAMES } from "../../common/contextVariablesNames";
import { InspectorViewFactory } from "../networkInspector/views/inspectorViewFactory";
import { AppLauncher } from "../appLauncher";
import { OutputChannelLogger } from "../log/OutputChannelLogger";

interface NetworkInspectorModule {
    networkInspector: NetworkInspectorServer;
    androidDeviceTracker: AndroidDeviceTracker;
    iOSDeviceTracker: IOSDeviceTracker | undefined;
}

/**
 * Manages the lifecycle of Network Inspector module.
 * Responsible for starting, stopping, and tracking the state of network inspection.
 */
export class NetworkInspectorManager {
    private networkInspectorModule: NetworkInspectorModule | undefined;

    /**
     * Starts the Network Inspector module.
     * @param project The app launcher project
     * @throws Error if Network Inspector is already running
     */
    async start(project: AppLauncher): Promise<void> {
        if (this.networkInspectorModule) {
            throw new Error("Network Inspector is already running");
        }

        const adbHelper = new AdbHelper(
            project.getPackager().getProjectPath(),
            project.getOrUpdateNodeModulesRoot(),
        );
        const networkInspector = new NetworkInspectorServer();
        const androidDeviceTracker = new AndroidDeviceTracker(adbHelper);
        const iOSDeviceTracker =
            (process.platform === "darwin" && new IOSDeviceTracker()) || undefined;

        this.networkInspectorModule = {
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
            await this.stop();
            throw err;
        }
    }

    /**
     * Stops the Network Inspector module and cleans up resources.
     * Attempts every cleanup step and retains the module for retry if cleanup fails.
     */
    async stop(): Promise<void> {
        if (!this.networkInspectorModule) {
            return;
        }

        const module = this.networkInspectorModule;
        const errors: unknown[] = [];
        const cleanup = async (action: () => void | PromiseLike<unknown>): Promise<void> => {
            try {
                await action();
            } catch (error) {
                errors.push(error);
                OutputChannelLogger.getMainChannel().error(
                    String(error),
                    error instanceof Error ? error : undefined,
                );
            }
        };

        await cleanup(() => module.androidDeviceTracker.stop());
        await cleanup(() => module.iOSDeviceTracker?.stop());
        await cleanup(() => module.networkInspector.stop());
        await cleanup(() => InspectorViewFactory.clearCache());
        await cleanup(() =>
            vscode.commands.executeCommand(
                "setContext",
                CONTEXT_VARIABLES_NAMES.IS_RNT_NETWORK_INSPECTOR_RUNNING,
                errors.length > 0,
            ),
        );

        if (errors.length > 0) {
            throw errors[0];
        }

        this.networkInspectorModule = undefined;
    }

    /**
     * Checks if the Network Inspector module is currently running.
     * @returns true if running, false otherwise
     */
    isRunning(): boolean {
        return !!this.networkInspectorModule;
    }
}
