// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.

import * as assert from "assert";
import { ErrorHelper } from "../../common/error/errorHelper";
import { InternalErrorCode } from "../../common/error/internalErrorCode";
import { ProjectVersionHelper } from "../../common/projectVersionHelper";
import { SettingsHelper } from "../settingsHelper";
import { ReactNativeCommand } from "./util/reactNativeCommand";

export class RestartPackager extends ReactNativeCommand {
    codeName = "restartPackager";
    label = "Restart Packager";
    error = ErrorHelper.getInternalError(InternalErrorCode.FailedToRestartPackager);

    async baseFn() {
        assert(this.project);
        const nodeModulesRoot = this.project.getOrUpdateNodeModulesRoot();
        // #todo> why is this required?
        await ProjectVersionHelper.getReactNativePackageVersionsFromNodeModules(nodeModulesRoot);

        return await this.project
            .getPackager()
            .restart(SettingsHelper.getPackagerPort(this.project.getWorkspaceFolderUri().fsPath));
    }
}
