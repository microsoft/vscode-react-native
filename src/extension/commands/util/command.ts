// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.

import assert = require("assert");
import * as vscode from "vscode";
import { EntryPointHandler } from "../../../common/entryPointHandler";
import { ErrorHelper } from "../../../common/error/errorHelper";
import { InternalError } from "../../../common/error/internalError";
import { InternalErrorCode } from "../../../common/error/internalErrorCode";
import { AppLauncher } from "../../appLauncher";
import { PlatformType } from "../../launchArgs";
import { OutputChannelLogger } from "../../log/OutputChannelLogger";
import { ProjectsStorage } from "../../projectsStorage";

export abstract class Command {
    private static instances = new Set<typeof Command>();

    private entryPointHandler?: EntryPointHandler;

    abstract readonly codeName: string;
    abstract readonly label: string;
    abstract readonly error: InternalError;

    /** Initialize project property before executing command */
    requiresProject = true;
    /** Throw an Error if workspace is not trusted before executing command */
    requiresTrust = true;

    get platform(): string {
        return (
            [PlatformType.Android, PlatformType.iOS, PlatformType.Exponent].find(it =>
                this.codeName.includes(it),
            ) || ""
        );
    }

    protected project?: AppLauncher;

    constructor() {
        assert(!Command.instances.has(new.target), "Command can only be created once");
        Command.instances.add(new.target);
    }

    abstract baseFn(...args: any[]): Promise<void>; // add vscode command arguments

    protected createHandler(fn = this.baseFn.bind(this)) {
        return async (...args: any[]) => {
            assert(this.entryPointHandler, "this.entryPointHandler is not defined");

            const outputChannelLogger = OutputChannelLogger.getMainChannel();

            if (this.requiresProject) {
                this.project = await this.selectProject();
            }

            if (this.requiresTrust && !isWorkspaceTrusted()) {
                throw ErrorHelper.getInternalError(
                    InternalErrorCode.WorkspaceIsNotTrusted,
                    this.project || undefined,
                    this.label,
                );
            }

            outputChannelLogger.debug(`Run command: ${this.codeName}`);

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

        function isWorkspaceTrusted() {
            // Remove after updating supported VS Code engine version to 1.57.0
            if (typeof (vscode.workspace as any).isTrusted === "boolean") {
                return (vscode.workspace as any).isTrusted;
            }

            return true;
        }
    }

    register = (() => {
        let isCalled = false;
        return (entryPointHandler: EntryPointHandler) => {
            this.entryPointHandler = entryPointHandler;

            assert(!isCalled, "Command can only be registered once");
            isCalled = true;
            return vscode.commands.registerCommand(
                `reactNative.${this.codeName}`,
                this.createHandler(),
            );
        };
    })();

    private async selectProject() {
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

        assert(selected, "Selection canceled");

        logger.debug(`Command palette: selected project ${selected}`);
        return ProjectsStorage.projectsCache[selected];
    }
}
