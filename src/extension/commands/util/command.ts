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
import { selectProject } from ".";

export abstract class Command<ArgT extends unknown[] = []> {
    private static instances = new Map<Command, unknown>();

    static formInstance<T extends { prototype: unknown }>(this: T): T["prototype"] {
        // 'any' because TypeScript is wrong
        // workaround from https://github.com/microsoft/TypeScript/issues/5863
        const that = this as any;
        const result = Command.instances.get(that) || new that();
        Command.instances.set(that, result);
        return result;
    }

    abstract readonly codeName: string;
    abstract readonly label: string;
    abstract readonly error: InternalError;

    get platform(): string {
        return (
            [
                PlatformType.Android,
                PlatformType.iOS,
                PlatformType.Exponent,
                PlatformType.macOS,
                PlatformType.Windows,
            ].find(it => this.codeName.toLowerCase().includes(it.toLowerCase())) || ""
        );
    }

    private entryPointHandler?: EntryPointHandler;

    /** Initialize project property before executing command */
    protected requiresProject = true;

    /** Throw an Error if workspace is not trusted before executing command */
    protected requiresTrust = true;

    protected project?: AppLauncher;

    protected constructor() {}

    protected createHandler(fn = this.baseFn.bind(this)) {
        return async (...args: ArgT) => {
            assert(this.entryPointHandler, "this.entryPointHandler is not defined");

            const resultFn = async () => {
                await this.onBeforeExecute(...args);
                await fn.bind(this)(...args);
            };

            OutputChannelLogger.getMainChannel().debug(`Run command: ${this.codeName}`);

            await this.entryPointHandler.runFunctionWExtProps(
                `commandPalette.${this.codeName}`,
                {
                    platform: {
                        value: this.platform,
                        isPii: false,
                    },
                },
                this.error,
                resultFn.bind(this),
            );
        };
    }

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    protected async onBeforeExecute(...args: ArgT): Promise<void> {
        if (this.requiresProject) {
            this.project = await selectProject();
        }

        if (this.requiresTrust && !isWorkspaceTrusted()) {
            throw ErrorHelper.getInternalError(
                InternalErrorCode.WorkspaceIsNotTrusted,
                this.project?.getPackager().getProjectPath() || undefined,
                this.label,
            );
        }

        function isWorkspaceTrusted() {
            // Remove after updating supported VS Code engine version to 1.57.0
            if (typeof (vscode.workspace as any).isTrusted === "boolean") {
                return (vscode.workspace as any).isTrusted;
            }

            return true;
        }
    }

    abstract baseFn(...args: ArgT): Promise<void>;

    /** Execute base command without telemetry */
    async executeLocally(...args: ArgT) {
        await this.onBeforeExecute(...args);
        await this.baseFn(...args);
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
}
