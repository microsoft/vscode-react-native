// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.

import * as assert from "assert";
import { ErrorHelper } from "../../common/error/errorHelper";
import { InternalErrorCode } from "../../common/error/internalErrorCode";
import { OutputChannelLogger } from "../log/OutputChannelLogger";
import { AppLauncher } from "../appLauncher";
import { CommandExecutor } from "../../common/commandExecutor";
import { ReactNativeCommand } from "./util/reactNativeCommand";

export class Prebuild extends ReactNativeCommand {
    codeName = "expoPrebuild";
    label = "Expo Prebuild";
    error = ErrorHelper.getInternalError(InternalErrorCode.FailedToRunPrebuild);

    async baseFn(): Promise<void> {
        assert(this.project);
        const projectRootPath = this.project.getPackager().getProjectPath();
        const logger = OutputChannelLogger.getChannel("Expo Prebuild", true);
        const nodeModulesRoot: string =
            AppLauncher.getNodeModulesRootByProjectPath(projectRootPath);
        const commandExecutor = new CommandExecutor(nodeModulesRoot, projectRootPath, logger);
        logger.info("Running expo prebuild command...");
        await commandExecutor.execute("npx expo prebuild");
    }
}
