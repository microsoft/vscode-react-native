// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.

import * as assert from "assert";
import * as vscode from "vscode";
import { ReactNativeProjectHelper } from "../../../common/reactNativeProjectHelper";
import { TelemetryHelper } from "../../../common/telemetryHelper";
import { OutputChannelLogger } from "../../log/OutputChannelLogger";
import { SettingsHelper } from "../../settingsHelper";
import { Command } from "./command";
import { selectProject } from ".";

export abstract class ReactNativeCommand extends Command {
    /** Execute base command with some telemetry */
    async executeLocally<T extends ReactNativeCommand>(
        this: T,
        ...args: Parameters<T["baseFn"]> | Parameters<T["onBeforeExecute"]>
    ) {
        if (this.requiresProject) {
            this.project = await selectProject().catch(() => undefined);
        }

        await this.onBeforeExecute(...args);
        await this.executeInContext(this.baseFn.bind(this, ...args));
    }

    /** Execute some task before RN telemetry. Does not have acces to `this.project` */
    async onBeforeExecute(...args: unknown[]): Promise<void> {
        args;
    }

    protected createHandler(fn = this.baseFn.bind(this)) {
        return super.createHandler(async (...args: unknown[]) => {
            await this.onBeforeExecute(...args);
            await this.executeInContext(fn.bind(this, ...args));
        });
    }

    private async executeInContext(operation: () => Promise<void>) {
        assert(this.project);

        const logger = OutputChannelLogger.getMainChannel();
        const projectRoot = SettingsHelper.getReactNativeProjectRoot(
            this.project.getWorkspaceFolder().uri.fsPath,
        );
        const isRNProject = await ReactNativeProjectHelper.isReactNativeProject(projectRoot);

        logger.debug(`Command palette: run project ${projectRoot} in context`);

        await TelemetryHelper.generate(
            "RNCommand",
            {
                platform: {
                    value: this.platform,
                    isPii: false,
                },
            },
            async generator => {
                generator.add("command", this.codeName, false);
                generator.add("isRNProject", isRNProject, false);

                if (!isRNProject) {
                    void vscode.window.showErrorMessage(
                        `${projectRoot} workspace is not a React Native project.`,
                    );
                    return;
                }

                logger.setFocusOnLogChannel();
                await operation();
            },
        );
    }
}
