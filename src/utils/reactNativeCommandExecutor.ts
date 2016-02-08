// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.

import {CommandExecutor} from "./commands/commandExecutor";
import {Log} from "./commands/log";
import {Packager} from "./../debugger/packager";
import {ReactNativeProjectHelper} from "./reactNativeProjectHelper";
import * as vscode from "vscode";

export class ReactNativeCommandExecutor {
    private reactNativePackager: Packager;
    private workspaceRoot: string;

    constructor(workspaceRoot: string) {
        this.workspaceRoot = workspaceRoot;
        this.reactNativePackager = new Packager(workspaceRoot);
    }

    /**
     * Ensures that we are in a React Native project and then executes the operation
     * Otherwise, displays an error message banner
     * {operation} - a function that performs the expected operation
     */
    public executeCommandInContext(operation: () => void): void {
        let reactNativeProjectHelper = new ReactNativeProjectHelper(vscode.workspace.rootPath);
        reactNativeProjectHelper.isReactNativeProject().done(isRNProject => {
            if (isRNProject) {
                operation();
            } else {
                vscode.window.showErrorMessage("Current workspace is not a React Native project.");
            }
        });
    }

    /**
     * Starts the React Native packager
     */
    public startPackager(): void {
        this.reactNativePackager.start(vscode.window.createOutputChannel("React-Native"))
            .done();
    }

    /**
     * Kills the React Native packager invoked by the extension's packager
     */
    public stopPackager(): void {
        this.reactNativePackager.stop(vscode.window.createOutputChannel("React-Native"));
    }

    /**
     * Executes the 'react-native run-android' command
     */
    public runAndroid(): void {
        this.executeReactNativeRunCommand("run-android");
    }

    /**
     * Executes the 'react-native run-ios' command
     */
    public runIos(): void {
        this.executeReactNativeRunCommand("run-ios");
    }

    /**
     * Executes a react-native command passed after starting the packager
     * {command} The command to be executed
     * {args} The arguments to be passed to the command
     */
    public executeReactNativeRunCommand(command: string, args?: string[]): Q.Promise<void> {
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
}
