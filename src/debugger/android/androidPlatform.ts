// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.

import * as Q from "q";
import {IAppPlatform} from "../platformResolver";
import {IRunOptions} from "../../common/launchArgs";
import {CommandExecutor} from "../../common/commandExecutor";
import {Package} from "../../common/node/package";
import {PackageNameResolver} from "../../common/android/packageNameResolver";

/**
 * Android specific platform implementation for debugging RN applications.
 */
export class AndroidPlatform implements IAppPlatform {

    public runApp(runOptions: IRunOptions): Q.Promise<void> {
        return new CommandExecutor(runOptions.projectRoot).spawnAndWaitReactCommand("run-android");
    }

    public enableJSDebuggingMode(runOptions: IRunOptions): Q.Promise<void> {
        let pkg = new Package(runOptions.projectRoot);

        return pkg.name()
            .then(appName => new PackageNameResolver(appName).resolvePackageName(runOptions.projectRoot))
            .then(packageName => {
                let enableDebugCommand = `adb shell am broadcast -a "${packageName.toLowerCase()}.RELOAD_APP_ACTION" --ez jsproxy true`;
                let cexec = new CommandExecutor(runOptions.projectRoot);
                return cexec.execute(enableDebugCommand);
            });
    }
}