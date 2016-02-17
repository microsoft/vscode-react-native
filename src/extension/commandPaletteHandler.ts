// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.

import {CommandExecutor} from "../common/commandExecutor";
import {Log} from "../common/log";
import {Packager} from "../common/packager";
import {ReactNativeProjectHelper} from "../common/reactNativeProjectHelper";
import {TelemetryHelper} from "../common/telemetryHelper";
import * as vscode from "vscode";

export class CommandPaletteHandler {
    private reactNativePackager: Packager;
    private workspaceRoot: string;

    constructor(workspaceRoot: string) {
        this.workspaceRoot = workspaceRoot;
        this.reactNativePackager = new Packager(workspaceRoot);
    }

    /**
     * Starts the React Native packager
     */
    public startPackager(): void {
        return this.executeCommandInContext("startPackager", () => this.reactNativePackager.start(vscode.window.createOutputChannel("React-Native")).done());
    }

    /**
     * Kills the React Native packager invoked by the extension's packager
     */
    public stopPackager(): void {
        return this.executeCommandInContext("stopPackager", () => this.reactNativePackager.stop(vscode.window.createOutputChannel("React-Native")));
    }

    /**
     * Executes the 'react-native run-android' command
     */
    public runAndroid(): void {
        return this.executeCommandInContext("runAndroid", () => this.executeReactNativeRunCommand("run-android"));
    }

    /**
     * Executes the 'react-native run-ios' command
     */
    public runIos(): void {
        return this.executeCommandInContext("runIos", () => this.executeReactNativeRunCommand("run-ios"));
    }

    /**
     * Executes a react-native command passed after starting the packager
     * {command} The command to be executed
     * {args} The arguments to be passed to the command
     */
    private executeReactNativeRunCommand(command: string, args?: string[]): Q.Promise<void> {
        // Start the packager before executing the React-Native command
        let outputChannel = vscode.window.createOutputChannel("React-Native");
        Log.appendStringToOutputChannel("Attempting to start the React Native packager", outputChannel);

        return this.reactNativePackager.start(outputChannel)
            .then(() => {
                return new CommandExecutor(this.workspaceRoot).spawnReactCommand(command, args, undefined, outputChannel);
            }).then(() => {
                return Q.resolve<void>(void 0);
            });
    }

    /**
     * Ensures that we are in a React Native project and then executes the operation
     * Otherwise, displays an error message banner
     * {operation} - a function that performs the expected operation
     */
    private executeCommandInContext(rnCommand: string, operation: () => void): void {
        let reactNativeProjectHelper = new ReactNativeProjectHelper(vscode.workspace.rootPath);
        TelemetryHelper.generate("RNCommand", (generator) => {
            generator.add("command", rnCommand, false);
            return reactNativeProjectHelper.isReactNativeProject().then(isRNProject => {
                if (isRNProject) {
                    return operation();
                } else {
                    vscode.window.showErrorMessage("Current workspace is not a React Native project.");
                }
            });
        }).done();
    }
}
