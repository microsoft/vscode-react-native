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
    private startOperation: Promise<void> | undefined;
    private stopOperation: Promise<void> | undefined;

    /**
     * Starts the Network Inspector module.
     * @param project The app launcher project
     * @throws Error if Network Inspector is already starting, running, or stopping
     */
    async start(project: AppLauncher): Promise<void> {
        if (this.networkInspectorModule || this.startOperation || this.stopOperation) {
            throw new Error("Network Inspector is already running");
        }

        const operation = this.startModule(project);
        this.startOperation = operation;
        try {
            await operation;
        } catch (err) {
            try {
                await this.stop();
            } catch (cleanupError) {
                OutputChannelLogger.getMainChannel().error(
                    `Failed to clean up Network Inspector after startup failed: ${String(
                        cleanupError,
                    )}`,
                    cleanupError instanceof Error ? cleanupError : undefined,
                );
            }
            throw err;
        } finally {
            this.startOperation = undefined;
        }
    }

    /**
     * Waits for startup to settle before stopping. Concurrent stops share one cleanup operation.
     */
    stop(): Promise<void> {
        if (this.stopOperation) {
            return this.stopOperation;
        }
        if (!this.networkInspectorModule && !this.startOperation) {
            return Promise.resolve();
        }

        const cleanup = () => this.stopModule();
        // start() reports startup failures; either outcome must be followed by cleanup.
        const operation = this.startOperation
            ? this.startOperation.then(cleanup, cleanup)
            : Promise.resolve().then(cleanup);
        this.stopOperation = operation.finally(() => {
            this.stopOperation = undefined;
        });
        return this.stopOperation;
    }

    private async startModule(project: AppLauncher): Promise<void> {
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

        if (iOSDeviceTracker) {
            await iOSDeviceTracker.start();
        }
        await androidDeviceTracker.start();
        await networkInspector.start(adbHelper);
        await vscode.commands.executeCommand(
            "setContext",
            CONTEXT_VARIABLES_NAMES.IS_RNT_NETWORK_INSPECTOR_RUNNING,
            true,
        );
    }

    /**
     * Stops the Network Inspector module and cleans up resources.
     */
    private async stopModule(): Promise<void> {
        const module = this.networkInspectorModule;
        if (!module) {
            return;
        }

        module.androidDeviceTracker.stop();
        module.iOSDeviceTracker?.stop();
        await module.networkInspector.stop();
        InspectorViewFactory.clearCache();

        await vscode.commands.executeCommand(
            "setContext",
            CONTEXT_VARIABLES_NAMES.IS_RNT_NETWORK_INSPECTOR_RUNNING,
            false,
        );
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
