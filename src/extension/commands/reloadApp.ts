// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.

import * as assert from "assert";
import * as nls from "vscode-nls";
import { ErrorHelper } from "../../common/error/errorHelper";
import { InternalErrorCode } from "../../common/error/internalErrorCode";
import { ProjectVersionHelper, REACT_NATIVE_PACKAGES } from "../../common/projectVersionHelper";
import { PlatformType } from "../launchArgs";
import { AndroidPlatform } from "../android/androidPlatform";
import { IOSPlatform } from "../ios/iOSPlatform";
import { WindowsPlatform } from "../windows/windowsPlatform";
import { getRunOptions } from "./util";
import { Command } from "./util/command";

nls.config({
    messageFormat: nls.MessageFormat.bundle,
    bundleFormat: nls.BundleFormat.standalone,
})();
const localize = nls.loadMessageBundle();

export class ReloadApp extends Command {
    codeName = "reloadApp";
    label = "ReloadApp";
    error = ErrorHelper.getInternalError(
        InternalErrorCode.CommandFailed,
        localize("ReactNativeReloadApp", "React Native: Reload App"),
    );

    async baseFn() {
        assert(this.project);

        const androidPlatform = new AndroidPlatform(
            getRunOptions(this.project, PlatformType.Android),
            {
                packager: this.project.getPackager(),
            },
        );

        androidPlatform.reloadApp().catch(() => {});

        if (process.platform === "win32") {
            const nodeModulesRoot = this.project.getOrUpdateNodeModulesRoot();
            const RNPackageVersions =
                await ProjectVersionHelper.getReactNativePackageVersionsFromNodeModules(
                    nodeModulesRoot,
                    [REACT_NATIVE_PACKAGES.REACT_NATIVE_WINDOWS],
                );

            const isRNWProject = !ProjectVersionHelper.isVersionError(
                RNPackageVersions.reactNativeWindowsVersion,
            );

            if (isRNWProject) {
                const windowsPlatform = new WindowsPlatform(
                    getRunOptions(this.project, PlatformType.Windows),
                    {
                        packager: this.project.getPackager(),
                    },
                );
                windowsPlatform.reloadApp(this.project).catch(() => {});
            }
        } else if (process.platform === "darwin") {
            const iosPlatform = new IOSPlatform(getRunOptions(this.project, PlatformType.iOS), {
                packager: this.project.getPackager(),
            });

            iosPlatform.reloadApp(this.project).catch(() => {});
        }
    }
}
