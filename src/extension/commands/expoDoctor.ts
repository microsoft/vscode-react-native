// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.

import assert = require("assert");
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
        const result = new ChildProcess().spawn("npx", ["expo-doctor"], {
            cwd: projectRootPath,
        });
        const stdoutChunks: string[] = [];
        const stderrChunks: string[] = [];
        result.stdout.on("data", data => stdoutChunks.push(data.toString()));
        result.stderr.on("data", data => stderrChunks.push(data.toString()));

        logger.info("Running diagnostics...");
        try {
            await result.outcome;
        } finally {
            const stdout = stdoutChunks.join("");
            const stderr = stderrChunks.join("");
            if (stdout) {
                logger.info(stdout);
            }
            if (stderr) {
                logger.error(stderr);
            }
        }
    }
}
