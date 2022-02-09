// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.

import * as assert from "assert";
import { ErrorHelper } from "../../common/error/errorHelper";
import { InternalErrorCode } from "../../common/error/internalErrorCode";
import { ProjectVersionHelper, REACT_NATIVE_PACKAGES } from "../../common/projectVersionHelper";
import { RNProjectObserver } from "../rnProjectObserver";
import { runChecks } from "../services/validationService/checker";
import { ValidationCategoryE } from "../services/validationService/checks/types";
import { SettingsHelper } from "../settingsHelper";
import { Command } from "./util/command";

export class TestDevEnvironment extends Command {
    codeName = "testDevEnvironment";
    label = "Check development environment configuration";
    error = ErrorHelper.getInternalError(InternalErrorCode.FailedToTestDevEnvironment);

    private async createRNProjectObserver() {
        assert(this.project);

        const nodeModulesRoot = this.project.getOrUpdateNodeModulesRoot();
        const projectRootPath = SettingsHelper.getReactNativeProjectRoot(
            this.project.getWorkspaceFolderUri().fsPath,
        );
        const versions = await ProjectVersionHelper.getReactNativePackageVersionsFromNodeModules(
            nodeModulesRoot,
            [REACT_NATIVE_PACKAGES.REACT_NATIVE_WINDOWS],
        );
        return new RNProjectObserver(projectRootPath, versions);
    }

    async baseFn() {
        assert(this.project);

        const projectObserver = await this.createRNProjectObserver().catch(() => {});
        const shouldCheck = {
            [ValidationCategoryE.Expo]:
                (await this.project
                    ?.getPackager()
                    .getExponentHelper()
                    .isExpoManagedApp(false)
                    .catch(() => false)) || false,
            [ValidationCategoryE.Windows]:
                (projectObserver && projectObserver.isRNWindowsProject) || false,
        } as const;

        await runChecks(shouldCheck);
    }
}
