// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.

import * as vscode from "vscode";
import { ReactNativeProjectHelper } from "../../../common/reactNativeProjectHelper";
import { TelemetryHelper } from "../../../common/telemetryHelper";
import { OutputChannelLogger } from "../../log/OutputChannelLogger";
import { SettingsHelper } from "../../settingsHelper";
import { Command } from "./command";
import { selectProject } from ".";

export abstract class ReactNativeCommand extends Command {
    /** Execute base command with some telemetry */
    async executeLocally<T extends ReactNativeCommand>(this: T, ...args: Parameters<T["baseFn"]>) {
        await this.onBeforeExecute();
        await this.executeInContext(this.baseFn.bind(this, ...args));
    }

    protected async onBeforeExecute(): Promise<void> {}

    protected createHandler(fn = this.baseFn.bind(this)) {
        return super.createHandler(() => this.executeInContext(fn));
    }

    private async executeInContext(operation: () => Promise<void>) {
        this.project = await selectProject();
        await this.onBeforeExecute();

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
