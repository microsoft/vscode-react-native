// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.

import { ErrorHelper } from "../../common/error/errorHelper";
import { InternalErrorCode } from "../../common/error/internalErrorCode";
import { ProjectVersionHelper } from "../../common/projectVersionHelper";
import { ReactNativeCommand, selectProject } from "./_util";

export class StartPackager extends ReactNativeCommand {
    codeName = "startPackager";
    label = "Start Packager";
    error = ErrorHelper.getInternalError(InternalErrorCode.FailedToStartPackager);

    async baseFn() {
        const appLauncher = await selectProject();
        // #todo> why is this required?
        await ProjectVersionHelper.getReactNativePackageVersionsFromNodeModules(
            appLauncher.getOrUpdateNodeModulesRoot(),
        );

        if (await appLauncher.getPackager().isRunning()) {
            await appLauncher.getPackager().stop();
        }
        await appLauncher.getPackager().start();
    }
}
