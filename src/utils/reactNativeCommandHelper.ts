// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.

import {CommandExecutor} from "./commands/commandExecutor";
import {PlatformResolver} from "./../debugger/platformResolver";
import {window} from "vscode";

export class ReactNativeCommandHelper {
    public static executeReactNativeCommand(projectRoot: string, command: string): void {
        let resolver = new PlatformResolver();
        let desktopPlatform = resolver.resolveDesktopPlatform();

        // Invoke "react-native" with the command passed
        return new CommandExecutor(projectRoot).spawn(desktopPlatform.reactNativeCommandName, [command], {}, window.createOutputChannel("React-Native")).done();
    }

    public static startPackager(projectRoot: string): void {
        let resolver = new PlatformResolver();
        let desktopPlatform = resolver.resolveDesktopPlatform();

        // The packager will continue running while we debug the application, so we can"t
        // wait for this command to finish
        return new CommandExecutor(projectRoot).spawn(desktopPlatform.reactNativeCommandName, ["start"]).done();
    }

    public static stopPackager(projectRoot: string): void {
        let resolver = new PlatformResolver();
        let desktopPlatform = resolver.resolveDesktopPlatform();

        // The packager will continue running while we debug the application, so we can"t
        // wait for this command to finish
        return new CommandExecutor(projectRoot).spawn(desktopPlatform.reactNativeCommandName, ["start"]).done();
    }
}
