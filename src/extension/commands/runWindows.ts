// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.

import { ErrorHelper } from "../../common/error/errorHelper";
import { InternalErrorCode } from "../../common/error/internalErrorCode";
import { ProjectVersionHelper, REACT_NATIVE_PACKAGES } from "../../common/projectVersionHelper";
import { ParsedPackage } from "../../common/reactNativeProjectHelper";
import { TargetPlatformHelper } from "../../common/targetPlatformHelper";
import { PlatformType } from "../launchArgs";
import { TipNotificationService } from "../services/tipsNotificationsService/tipsNotificationService";
import { WindowsPlatform } from "../windows/windowsPlatform";
import { getRunOptions, selectProject } from "./util";
import { ReactNativeCommand } from "./util/reactNativeCommand";

export class RunWindows extends ReactNativeCommand {
    codeName = "runWindows";
    label = "Run Windows";
    error = ErrorHelper.getInternalError(InternalErrorCode.FailedToRunOnWindows);

    async baseFn() {
        this.project = await selectProject();

        const platform = new WindowsPlatform(getRunOptions(this.project, PlatformType.Windows), {
            packager: this.project.getPackager(),
        });
        await platform.beforeStartPackager();
        await platform.startPackager();
        await platform.runApp(false);
    }

    async onBeforeExecute() {
        this.project = await selectProject();
        void TipNotificationService.getInstance().setKnownDateForFeatureById(
            "debuggingRNWAndMacOSApps",
        );
        const additionalPackagesToCheck: ParsedPackage[] = [
            REACT_NATIVE_PACKAGES.REACT_NATIVE_WINDOWS,
        ];
        TargetPlatformHelper.checkTargetPlatformSupport(PlatformType.Windows);
        const versions = await ProjectVersionHelper.getReactNativePackageVersionsFromNodeModules(
            this.project.getOrUpdateNodeModulesRoot(),
            additionalPackagesToCheck,
        );
        this.project.setReactNativeVersions(versions);
    }
}
