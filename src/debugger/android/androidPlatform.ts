// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.

import * as Q from "q";
import {IAppPlatform} from "../platformResolver";
import {IRunOptions} from "../launchArgs";
import {CommandExecutor} from "../../common/commandExecutor";
import {Package} from "../../common/node/package";
import {PackageNameResolver} from "../../common/android/packageNameResolver";
import {MakeOutcomeFailDependingOnOutput, PatternToFailure} from "../../common/makeOutcomeFailDependingOnOutput";

/**
 * Android specific platform implementation for debugging RN applications.
 */
export class AndroidPlatform implements IAppPlatform {
    // We should add the common Android build/run erros we find to this list
    private static RUN_ANDROID_FAILURE_PATTERNS: PatternToFailure = {
        "Failed to install on any devices": "Could not install the app on any available device. Make sure you have a correctly"
         + " configured device or emulator running. See https://facebook.github.io/react-native/docs/android-setup.html",
    "com.android.ddmlib.ShellCommandUnresponsiveException": "An Android shell command timed-out. Please retry the operation.",
    "Android project not found": "Android project not found." };

    private static RUN_ANDROID_SUCCESS_PATTERNS: string[] = ["BUILD SUCCESSFUL", "Starting the app", "Starting: Intent"];

    public runApp(runOptions: IRunOptions): Q.Promise<void> {
        const runAndroidSpawn = new CommandExecutor(runOptions.projectRoot).spawnChildReactCommandProcess("run-android");
        return new MakeOutcomeFailDependingOnOutput(
            () =>
                Q(AndroidPlatform.RUN_ANDROID_SUCCESS_PATTERNS),
            () =>
                Q(AndroidPlatform.RUN_ANDROID_FAILURE_PATTERNS)).process(runAndroidSpawn);
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