// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.

import { ErrorHelper } from "../../common/error/errorHelper";
import { InternalError } from "../../common/error/internalError";
import { InternalErrorCode } from "../../common/error/internalErrorCode";
import { ProjectVersionHelper } from "../../common/projectVersionHelper";
import { SettingsHelper } from "../settingsHelper";
import { ReactNativeCommand, selectProject } from "./_util";

export class RestartPackager extends ReactNativeCommand {
    codeName = "restartPackager";
    label = "Restart Packager";
    error = ErrorHelper.getInternalError(InternalErrorCode.FailedToRestartPackager);

    async baseFn() {
        const appLauncher = await selectProject();
        const nodeModulesRoot = appLauncher.getOrUpdateNodeModulesRoot();
        // #todo> why is this required?
        await ProjectVersionHelper.getReactNativePackageVersionsFromNodeModules(nodeModulesRoot);

        return await appLauncher
            .getPackager()
            .restart(SettingsHelper.getPackagerPort(appLauncher.getWorkspaceFolderUri().fsPath));
    }
}
