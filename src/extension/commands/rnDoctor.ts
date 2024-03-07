// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.

import * as assert from "assert";
import { ReactNativeCommand } from "./util/reactNativeCommand";
import { ErrorHelper } from "../../common/error/errorHelper";
import { InternalErrorCode } from "../../common/error/internalErrorCode";
import { CommandExecutor } from "../../common/commandExecutor";
import { OutputChannelLogger } from "../log/OutputChannelLogger";
import { OutputVerifier, PatternToFailure } from "../../common/outputVerifier";
import { AppLauncher } from "../../extension/appLauncher";

export class rnDoctor extends ReactNativeCommand {
    private static RUN_DOCTOR_SUCCESS_PATTERNS: string[] = ["run doctor succeeded"];
    private static RUN_DOCTOR_FAILURE_PATTERNS: PatternToFailure[] = [
        {
            pattern: "Failed to run doctor",
            errorCode: InternalErrorCode.FailedToRunRNDoctor,
        },
    ];
    codeName = "doctor";
    label = "React Native Doctor";
    nodeModulesRoot: string;
    error = ErrorHelper.getInternalError(InternalErrorCode.FailedToRunRNDoctor);
    async baseFn(): Promise<void> {
        assert(this.project);
        const projectRootPath = this.project.getPackager().getProjectPath();
        const logger = OutputChannelLogger.getChannel("ReactNativeRunDoctor", true);
        const nodeModulesRoot: string =
            AppLauncher.getNodeModulesRootByProjectPath(projectRootPath);
        const commandExecutor = new CommandExecutor(nodeModulesRoot, projectRootPath, logger);
        const res = commandExecutor.spawnReactCommand("doctor");

        const output = new OutputVerifier(
            () => Promise.resolve(rnDoctor.RUN_DOCTOR_SUCCESS_PATTERNS),
            () => Promise.resolve(rnDoctor.RUN_DOCTOR_FAILURE_PATTERNS),
            "run doctor",
        ).process(res);
        await output;
    }
}
