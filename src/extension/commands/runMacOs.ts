// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.

import { ErrorHelper } from "../../common/error/errorHelper";
import { InternalErrorCode } from "../../common/error/internalErrorCode";
import { ProjectVersionHelper, REACT_NATIVE_PACKAGES } from "../../common/projectVersionHelper";
import { ParsedPackage } from "../../common/reactNativeProjectHelper";
import { TargetPlatformHelper } from "../../common/targetPlatformHelper";
import { PlatformType } from "../launchArgs";
import { MacOSPlatform } from "../macos/macOSPlatform";
import { TipNotificationService } from "../services/tipsNotificationsService/tipsNotificationService";
import { getRunOptions, selectProject } from "./util";
import { ReactNativeCommand } from "./util/reactNativeCommand";

export class RunMacOS extends ReactNativeCommand {
    codeName = "runMacOS";
    label = "Run MacOS";
    error = ErrorHelper.getInternalError(InternalErrorCode.FailedToRunOnMacOS);

    async baseFn() {
        this.project = await selectProject();

        const platform = new MacOSPlatform(getRunOptions(this.project, PlatformType.macOS), {
            packager: this.project.getPackager(),
        });

        try {
            await platform.beforeStartPackager();
            await platform.startPackager();
            await platform.disableJSDebuggingMode();
        } catch (e) {}

        await platform.runApp();
    }

    async onBeforeExecute() {
        this.project = await selectProject();
        void TipNotificationService.getInstance().setKnownDateForFeatureById(
            "debuggingRNWAndMacOSApps",
        );
        const additionalPackagesToCheck: ParsedPackage[] = [
            REACT_NATIVE_PACKAGES.REACT_NATIVE_MACOS,
        ];
        TargetPlatformHelper.checkTargetPlatformSupport(PlatformType.macOS);
        const versions = await ProjectVersionHelper.getReactNativePackageVersionsFromNodeModules(
            this.project.getOrUpdateNodeModulesRoot(),
            additionalPackagesToCheck,
        );
        this.project.setReactNativeVersions(versions);
    }
}
