// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.

import assert = require("assert");
import * as vscode from "vscode";
import * as nls from "vscode-nls";
import { EntryPointHandler } from "../../common/entryPointHandler";
import { ErrorHelper } from "../../common/error/errorHelper";
import { InternalError } from "../../common/error/internalError";
import { InternalErrorCode } from "../../common/error/internalErrorCode";
import { ReactNativeProjectHelper } from "../../common/reactNativeProjectHelper";
import { TelemetryHelper } from "../../common/telemetryHelper";
import { AppLauncher } from "../appLauncher";
import {
    IAndroidRunOptions,
    IIOSRunOptions,
    ImacOSRunOptions,
    IWindowsRunOptions,
    PlatformType,
} from "../launchArgs";
import { OutputChannelLogger } from "../log/OutputChannelLogger";
import { ProjectsStorage } from "../projectsStorage";
import { SettingsHelper } from "../settingsHelper";
import { TargetType } from "../generalPlatform";
import { CommandExecutor } from "../../common/commandExecutor";

nls.config({
    messageFormat: nls.MessageFormat.bundle,
    bundleFormat: nls.BundleFormat.standalone,
})();
const localize = nls.loadMessageBundle();

export const getRunOptions = (
    project: AppLauncher,
    platform: PlatformType,
    target: TargetType = TargetType.Simulator,
) => {
    const folderUri = project.getWorkspaceFolderUri();

    const runOptions: IAndroidRunOptions | IIOSRunOptions | IWindowsRunOptions | ImacOSRunOptions =
        {
            platform,
            packagerPort: SettingsHelper.getPackagerPort(folderUri.fsPath),
            runArguments: SettingsHelper.getRunArgs(platform, target, folderUri),
            env: SettingsHelper.getEnvArgs(platform, target, folderUri),
            envFile: SettingsHelper.getEnvFile(platform, target, folderUri),
            projectRoot: SettingsHelper.getReactNativeProjectRoot(folderUri.fsPath),
            nodeModulesRoot: project.getOrUpdateNodeModulesRoot(),
            reactNativeVersions: project.getReactNativeVersions() || {
                reactNativeVersion: "",
                reactNativeWindowsVersion: "",
                reactNativeMacOSVersion: "",
            },
            workspaceRoot: project.getWorkspaceFolderUri().fsPath,
            ...(platform === PlatformType.iOS && target === "device" && { target: "device" }),
        };

    CommandExecutor.ReactNativeCommand = SettingsHelper.getReactNativeGlobalCommandName(
        project.getWorkspaceFolderUri(),
    );

    return runOptions;
};

export const loginToExponent = (project: AppLauncher): Promise<xdl.IUser> => {
    return project
        .getExponentHelper()
        .loginToExponent(
            (message, password) =>
                new Promise(
                    vscode.window.showInputBox({ placeHolder: message, password }).then,
                ).then(it => it || ""),
            message =>
                new Promise(vscode.window.showInformationMessage(message).then).then(
                    it => it || "",
                ),
        )
        .catch(err => {
            OutputChannelLogger.getMainChannel().warning(
                localize(
                    "ExpoErrorOccuredMakeSureYouAreLoggedIn",
                    "An error has occured. Please make sure you are logged in to Expo, your project is setup correctly for publishing and your packager is running as Expo.",
                ),
            );
            throw err;
        });
};

export abstract class Command {
    private static instances = new Set<typeof Command>();

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

    constructor(private entryPointHandler: EntryPointHandler) {
        assert(!Command.instances.has(new.target), "Command can only be created once");
        Command.instances.add(new.target);
    }

    abstract baseFn(): Promise<void>; // add vscode command arguments

    protected createHandler(fn = this.baseFn.bind(this)) {
        return async (...args: any[]) => {
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
        return () => {
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

        if (selected) {
            logger.debug(`Command palette: selected project ${selected}`);
            return ProjectsStorage.projectsCache[selected];
        }

        // #todo!> memory leak
        // left it as is to keep old behavior rn
        return new Promise(() => {}) as Promise<AppLauncher>;
    }
}

export abstract class ReactNativeCommand extends Command {
    async onBeforeExecute(): Promise<void> {}

    protected createHandler(fn = this.baseFn.bind(this)) {
        return super.createHandler(() => this.executeInContext(fn));
    }

    private async executeInContext(operation: () => Promise<void>) {
        assert(this.project);
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
