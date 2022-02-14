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

export abstract class Command {
    private static instances = new Map<typeof Command, unknown>();

    static formInstance<T extends typeof Command>(this: T): T["prototype"] {
        // 'any' because TypeScript is wrong
        // workaround from https://github.com/microsoft/TypeScript/issues/5863
        const result = this.instances.get(this) || new (this as any)();
        this.instances.set(this, result);
        return result;
    }

    abstract readonly codeName: string;
    abstract readonly label: string;
    abstract readonly error: InternalError;

    private entryPointHandler?: EntryPointHandler;

    // strange typing - see ReactNativeCommand, which extends this class
    /** Execute base command without telemetry */
    async executeLocally<T extends typeof Command>(
        this: T["prototype"],
        ...args: Parameters<T["prototype"]["baseFn"]>
    ) {
        await this.baseFn(...args);
    }

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

    protected constructor() {}

    abstract baseFn(...args: any[]): Promise<void>; // add vscode command arguments

    protected createHandler(fn = this.baseFn.bind(this)) {
        return async (...args: any[]) => {
            assert(this.entryPointHandler, "this.entryPointHandler is not defined");

            const outputChannelLogger = OutputChannelLogger.getMainChannel();

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
}
