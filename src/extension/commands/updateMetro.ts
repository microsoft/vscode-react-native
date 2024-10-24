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
import { OutputChannelLogger } from "../log/OutputChannelLogger";

const logger = OutputChannelLogger.getMainChannel();

export class updateMetro extends Command {
    codeName = "updateMetro";
    label = "Update metro bundler configure(from 0.76) -- Experimental";
    error = ErrorHelper.getInternalError(InternalErrorCode.FailedToUpdateMetro);
    private static RNVersion_Direct_Debug = "0.76.0";

    async baseFn(): Promise<void> {
        assert(this.project);

        const type = await vscode.window.showQuickPick([
            "Using react-native-tools debugger",
            "Default",
        ]);
        const projectRootPath = this.project.getPackager().getProjectPath();
        const versions = await ProjectVersionHelper.getReactNativeVersions(projectRootPath);
        if (semver.lt(versions.reactNativeVersion, updateMetro.RNVersion_Direct_Debug)) return;
        if (!type) return;
        if (type === "Using react-native-tools debugger") {
            logger.info("update metro bundle configuration to react-native-tools debugger");
            await switchBundleOptions(projectRootPath, true);
        }
        if (type === "Default") {
            logger.info("update metro bundle configuration to default");
            await switchBundleOptions(projectRootPath, false);
        }
    }
}
