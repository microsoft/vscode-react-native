// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.

import * as assert from "assert";
import * as vscode from "vscode";
import { ReactNativeProjectHelper } from "../../../common/reactNativeProjectHelper";
import { TelemetryHelper } from "../../../common/telemetryHelper";
import { OutputChannelLogger } from "../../log/OutputChannelLogger";
import { SettingsHelper } from "../../settingsHelper";
import { ErrorHelper } from "../../../common/error/errorHelper";
import { InternalErrorCode } from "../../../common/error/internalErrorCode";
import { Command } from "./command";

export abstract class ReactNativeCommand<ArgT extends unknown[] = never[]> extends Command<ArgT> {
    /** Execute base command with some telemetry */
    async executeLocally(...args: ArgT) {
        await this.onBeforeExecute(...args);
        await this.executeInContext(this.baseFn.bind(this, ...args));
    }

    /** Execute some task before RN telemetry */
    protected async onBeforeExecute(...args: ArgT): Promise<void> {
        await super.onBeforeExecute(...args);
    }

    protected createHandler(fn = this.baseFn.bind(this)) {
        return super.createHandler(async (...args: ArgT) => {
            await this.executeInContext(fn.bind(this, ...args));
        });
    }

    private async executeInContext(operation: () => Promise<void>) {
        assert(
            this.project,
            ErrorHelper.getInternalError(
                InternalErrorCode.WorkspaceNotFound,
                "Current workspace does not contain React Native projects.",
            ),
        );

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
