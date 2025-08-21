// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.

import * as assert from "assert";
import { ErrorHelper } from "../../common/error/errorHelper";
import { InternalErrorCode } from "../../common/error/internalErrorCode";
import { ChildProcess } from "../../common/node/childProcess";
import { OutputChannelLogger } from "../log/OutputChannelLogger";
import { ReactNativeCommand } from "./util/reactNativeCommand";

const logger = OutputChannelLogger.getMainChannel();
export class expoDoctor extends ReactNativeCommand {
    codeName = "expoDoctor";
    label = "Expo Doctor";
    error = ErrorHelper.getInternalError(InternalErrorCode.FailedToRunExpoDoctor);

    async baseFn(): Promise<void> {
        assert(this.project);
        const projectRootPath = this.project.getPackager().getProjectPath();
        const res = await new ChildProcess().exec("npx expo-doctor", { cwd: projectRootPath });
        logger.info("Running diagnostics...");
        const outcome = await res.outcome;
        logger.info(outcome);
    }
}
