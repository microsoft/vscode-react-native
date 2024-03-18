// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.

import * as assert from "assert";
import { ReactNativeCommand } from "./util/reactNativeCommand";
import { ErrorHelper } from "../../common/error/errorHelper";
import { InternalErrorCode } from "../../common/error/internalErrorCode";
import { ChildProcess } from "../../common/node/childProcess";
import { OutputChannelLogger } from "../log/OutputChannelLogger";

const logger = OutputChannelLogger.getMainChannel();
export class Prebuild extends ReactNativeCommand {
    codeName = "expoPrebuild";
    label = "Expo Prebuild";
    error = ErrorHelper.getInternalError(InternalErrorCode.FailedToRunPrebuild);

    async baseFn(): Promise<void> {
        assert(this.project);
        const projectRootPath = this.project.getPackager().getProjectPath();
        const res = await new ChildProcess().exec("npx expo prebuild", {
            cwd: projectRootPath,
        });
        logger.info("Running prebuild...");
        const outcome = await res.outcome;
        logger.info(outcome);
    }
}
