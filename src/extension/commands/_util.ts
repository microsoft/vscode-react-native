// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.

import assert = require("assert");
import * as vscode from "vscode";
import { EntryPointHandler } from "../../common/entryPointHandler";
import { ErrorHelper } from "../../common/error/errorHelper";
import { InternalError } from "../../common/error/internalError";
import { InternalErrorCode } from "../../common/error/internalErrorCode";
import { ReactNativeProjectHelper } from "../../common/reactNativeProjectHelper";
import { TelemetryHelper } from "../../common/telemetryHelper";
import { AppLauncher } from "../appLauncher";
import { PlatformType } from "../launchArgs";
import { OutputChannelLogger } from "../log/OutputChannelLogger";
import { ProjectsStorage } from "../projectsStorage";
import { SettingsHelper } from "../settingsHelper";

export const selectProject = async () => {
    const logger = OutputChannelLogger.getMainChannel();
    const projectKeys = Object.keys(ProjectsStorage.projectsCache);

    if (projectKeys.length === 0) {
        throw ErrorHelper.getInternalError(
            InternalErrorCode.WorkspaceNotFound,
            "Current workspace does not contain React Native projects.",
        );
    }

    if (projectKeys.length === 1) {
        logger.debug(`Command palette: once project ${projectKeys[0]}`);
        return ProjectsStorage.projectsCache[projectKeys[0]];
    }

    const selected = await vscode.window.showQuickPick(projectKeys).then(it => it);

    if (selected) {
        logger.debug(`Command palette: selected project ${selected}`);
        return ProjectsStorage.projectsCache[selected];
    }

    // #todo!> memory leak
    // left it as is to keep old behavior rn
    return new Promise(() => {}) as Promise<AppLauncher>;
};

export abstract class Command {
    abstract readonly codeName: string;
    abstract readonly label: string;
    /* Throw an Error if workspace is not trusted before executing command */
    requireTrust = true;
    error: InternalError;

    get platform(): string {
        return (
            [PlatformType.Android, PlatformType.iOS, PlatformType.Exponent].find(it =>
                this.codeName.includes(it),
            ) || ""
        );
    }

    constructor(private entryPointHandler: EntryPointHandler) {}

    abstract baseFn(): Promise<void>; // add vscode command arguments

    protected handler(fn = this.baseFn.bind(this)) {
        return async (...args: any[]) => {
            const outputChannelLogger = OutputChannelLogger.getMainChannel();

            if (this.requireTrust && !isWorkspaceTrusted()) {
                throw ErrorHelper.getInternalError(
                    InternalErrorCode.WorkspaceIsNotTrusted,
                    (await selectProject()).getWorkspaceFolder(),
                    this.label,
                );
            }

            outputChannelLogger.debug(`Run command: ${this.codeName}`);

            function isWorkspaceTrusted() {
                // Remove after updating supported VS Code engine version to 1.57.0
                if (typeof (vscode.workspace as any).isTrusted === "boolean") {
                    return (vscode.workspace as any).isTrusted;
                }

                return true;
            }

            await this.entryPointHandler.runFunctionWExtProps(
                `commandPalette.${this.codeName}`,
                {
                    platform: {
                        value: this.platform,
                        isPii: false,
                    },
                },
                this.error,
                fn.bind(this, ...args),
            );
        };
    }

    register() {
        return vscode.commands.registerCommand(`reactNative.${this.codeName}`, this.handler());
    }
}

export abstract class ReactNativeCommand extends Command {
    protected handler(fn = this.baseFn.bind(this)) {
        return super.handler(() => this.executeInContext(fn));
    }

    private async executeInContext(operation: () => Promise<void>) {
        const logger = OutputChannelLogger.getMainChannel();
        const projectRoot = await selectProject().then(it =>
            SettingsHelper.getReactNativeProjectRoot(it.getWorkspaceFolder().uri.fsPath),
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

// export abstract class DebuggingCommand extends Command {

// }
