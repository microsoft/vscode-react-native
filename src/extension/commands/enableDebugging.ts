// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.

import * as vscode from "vscode";
import * as assert from "assert";
import * as semver from "semver";
import { ErrorHelper } from "../../common/error/errorHelper";
import { InternalErrorCode } from "../../common/error/internalErrorCode";
import { Command } from "./util/command";
import { ProjectVersionHelper } from "../../common/projectVersionHelper";
import { switchBundleOptions } from "../../common/utils";

export class EnableDebugging extends Command {
    codeName = "debugEnable";
    label = "Enable Debugging";
    error = ErrorHelper.getInternalError(InternalErrorCode.FailedToEnableHermes);
    private static RN_Remote_jsDebug = "0.76.0";

    async baseFn(): Promise<void> {
        assert(this.project);

        const type = await vscode.window.showQuickPick([
            "Using react-native-tools debugger",
            "Default",
        ]);
        const projectRootPath = this.project.getPackager().getProjectPath();
        const versions = await ProjectVersionHelper.getReactNativeVersions(projectRootPath);
        if (semver.lt(versions.reactNativeVersion, EnableDebugging.RN_Remote_jsDebug)) return;
        if (!type) return;
        if (type === "Using react-native-tools debugger") {
            await switchBundleOptions(projectRootPath, true);
        }
        if (type === "Default") {
            await switchBundleOptions(projectRootPath, false);
        }
    }
}
