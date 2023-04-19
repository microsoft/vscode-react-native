// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.

import * as assert from "assert";
import * as nls from "vscode-nls";
import { OutputChannelLogger } from "../log/OutputChannelLogger";
import { ErrorHelper } from "../../common/error/errorHelper";
import { InternalErrorCode } from "../../common/error/internalErrorCode";
import { CommandExecutor } from "../../common/commandExecutor";
import { ReactNativeCommand } from "./util/reactNativeCommand";

nls.config({
    messageFormat: nls.MessageFormat.bundle,
    bundleFormat: nls.BundleFormat.standalone,
})();
const localize = nls.loadMessageBundle();

const logger = OutputChannelLogger.getMainChannel();

export class ConfigEASBuild extends ReactNativeCommand {
    nodeModulesRoot: string;
    codeName = "configExpoEASBuild";
    label = "Config Expo app with EAS build";
    error = ErrorHelper.getInternalError(InternalErrorCode.FailedToConfigEASBuild);

    async baseFn(): Promise<void> {
        assert(this.project);
        logger.info(localize("ConfigEASBuildInProgress", "Creating EAS build config file."));

        return new CommandExecutor(this.nodeModulesRoot).execute("eas build:configure");
    }
}
