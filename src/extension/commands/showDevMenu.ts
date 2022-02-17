// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.

import * as assert from "assert";
import * as nls from "vscode-nls";
import { ErrorHelper } from "../../common/error/errorHelper";
import { InternalErrorCode } from "../../common/error/internalErrorCode";
import { PlatformType } from "../launchArgs";
import { AndroidPlatform } from "../android/androidPlatform";
import { IOSPlatform } from "../ios/iOSPlatform";
import { getRunOptions } from "./util";
import { Command } from "./util/command";

nls.config({
    messageFormat: nls.MessageFormat.bundle,
    bundleFormat: nls.BundleFormat.standalone,
})();
const localize = nls.loadMessageBundle();

export class ShowDevMenu extends Command {
    codeName = "showDevMenu";
    requiresTrust = false;
    label = "Show Dev Menu";
    error = ErrorHelper.getInternalError(
        InternalErrorCode.CommandFailed,
        localize("ReactNativeShowDevMenu", "React Native: Show Developer Menu for app"),
    );

    async baseFn() {
        assert(this.project);

        const androidPlatform = new AndroidPlatform(
            getRunOptions(this.project, PlatformType.Android),
            {
                packager: this.project.getPackager(),
            },
        ) as AndroidPlatform;

        androidPlatform.showDevMenu().catch(() => {});

        if (process.platform === "darwin") {
            const iosPlatform = new IOSPlatform(getRunOptions(this.project, PlatformType.iOS), {
                packager: this.project.getPackager(),
            });

            iosPlatform.showDevMenu(this.project).catch(() => {});
        }
        if (process.platform === "win32") {
            // TODO: implement Show DevMenu command for RNW
        }
    }
}
