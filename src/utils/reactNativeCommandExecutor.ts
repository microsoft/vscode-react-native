// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.

import {CommandExecutor} from "./commands/commandExecutor";
import {PlatformResolver} from "./../debugger/platformResolver";
import {Packager} from "./../debugger/packager";
import {window} from "vscode";

export class ReactNativeCommandExecutor {
    private reactNativePackager: Packager;
    private workspaceRoot: string;

    constructor(workspaceRoot: string) {
        this.workspaceRoot = workspaceRoot;
        this.reactNativePackager = new Packager(workspaceRoot);
    }

    public executeReactNativeCommand(command: string): void {
        let resolver = new PlatformResolver();
        let desktopPlatform = resolver.resolveDesktopPlatform();

        // Invoke "react-native" with the command passed
        return new CommandExecutor(this.workspaceRoot).spawn(desktopPlatform.reactNativeCommandName, [command], {}, window.createOutputChannel("React-Native")).done();
    }

    public startPackager(): void {
        return this.reactNativePackager.start(true, window.createOutputChannel("React-Native")).done();
    }

    public stopPackager(): void {
        return this.reactNativePackager.stop(window.createOutputChannel("React-Native"));
    }
}
