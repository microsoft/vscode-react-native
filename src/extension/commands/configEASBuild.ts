// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.

import * as assert from "assert";
import * as nls from "vscode-nls";
import { OutputChannelLogger } from "../log/OutputChannelLogger";
import { ErrorHelper } from "../../common/error/errorHelper";
import { InternalErrorCode } from "../../common/error/internalErrorCode";
import { CommandExecutor } from "../../common/commandExecutor";
import { FileSystem } from "../../common/node/fileSystem";
import { ReactNativeCommand } from "./util/reactNativeCommand";

nls.config({
    messageFormat: nls.MessageFormat.bundle,
    bundleFormat: nls.BundleFormat.standalone,
})();
const localize = nls.loadMessageBundle();
const logger = OutputChannelLogger.getMainChannel();

export class ConfigEASBuild extends ReactNativeCommand {
    nodeModulesRoot: string;
    codeName = "createExpoEASBuildConfigFile";
    label = "Config Expo app with EAS build";
    error = ErrorHelper.getInternalError(InternalErrorCode.FailedToConfigEASBuild);

    async baseFn(): Promise<void> {
        assert(this.project);
        const projectRootPath = this.project.getPackager().getProjectPath();
        const expoHelper = this.project.getExponentHelper();
        logger.info(localize("CheckExpoEnvironment", "Checking Expo project environment."));
        const isExpo = await expoHelper.isExpoManagedApp(true);

        if (isExpo) {
            const fs = new FileSystem();
            const exists = await fs.exists(`${projectRootPath}/eas.json`);
            if (exists) {
                logger.info(
                    localize(
                        "FoundEASJsonFile",
                        "There is an eas.json file already existing in your app root.",
                    ),
                );
            } else {
                logger.info(
                    localize("ConfigEASBuildInProgress", "Creating EAS build config file."),
                );

                try {
                    await new CommandExecutor(this.nodeModulesRoot, projectRootPath).execute(
                        "eas build:configure --platform all",
                    );

                    logger.info(
                        localize(
                            "ConfigEASBuildSuccessfully",
                            "Create EAS build config file successfully.",
                        ),
                    );
                } catch {
                    logger.error(
                        localize(
                            "NoExistingEASProject",
                            "Unable to find existing EAS project. Please run 'eas init' firstly to bind your app to EAS project.",
                        ),
                    );
                }
            }
        } else {
            throw new Error(
                localize("NotExpoApplication", "The current app is not an Expo application."),
            );
        }
    }
}
