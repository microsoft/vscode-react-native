// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.

import * as Q from "q";
import {IMobilePlatform, IDesktopPlatform} from "../platformResolver";
import {IRunOptions} from "../launchArgs";
import {CommandExecutor} from "../../utils/commands/commandExecutor";
import {Package} from "../../utils/node/package";
import {ReactNativeCommandExecutor} from "../../utils/reactNativeCommandExecutor";

/**
 * Android specific platform implementation for debugging RN applications.
 */
export class AndroidPlatform implements IMobilePlatform {
    private desktopPlatform: IDesktopPlatform;

    constructor(desktopPlatform: IDesktopPlatform) {
        this.desktopPlatform = desktopPlatform;
    }

    public runApp(runOptions: IRunOptions): Q.Promise<void> {
        return new ReactNativeCommandExecutor(runOptions.projectRoot).executeReactNativeCommand("run-android");
    }

    public enableJSDebuggingMode(runOptions: IRunOptions): Q.Promise<void> {
        let pkg = new Package(runOptions.projectRoot);
        return pkg.name()
            .then(name => {
                let enableDebugCommand = `adb shell am broadcast -a "com.${name.toLowerCase()}.RELOAD_APP_ACTION" --ez jsproxy true`;
                let cexec = new CommandExecutor(runOptions.projectRoot);
                return cexec.execute(enableDebugCommand);
            });
    }
}