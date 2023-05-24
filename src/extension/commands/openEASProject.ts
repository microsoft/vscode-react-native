// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.

import * as assert from "assert";
import * as nls from "vscode-nls";
import * as vscode from "vscode";
import { OutputChannelLogger } from "../log/OutputChannelLogger";
import { ErrorHelper } from "../../common/error/errorHelper";
import { InternalErrorCode } from "../../common/error/internalErrorCode";
import { CommandExecutor } from "../../common/commandExecutor";
import { FileSystem } from "../../common/node/fileSystem";
import { ExponentHelper } from "../exponent/exponentHelper";
import { ReactNativeCommand } from "./util/reactNativeCommand";

nls.config({
    messageFormat: nls.MessageFormat.bundle,
    bundleFormat: nls.BundleFormat.standalone,
})();
const localize = nls.loadMessageBundle();
const logger = OutputChannelLogger.getMainChannel();

export class OpenEASProject extends ReactNativeCommand {
    nodeModulesRoot: string;
    codeName = "openEASProjectInWebPage";
    label = "Open the eas project in a web page";
    error = ErrorHelper.getInternalError(InternalErrorCode.FailedToOpenProjectPage);

    async baseFn(): Promise<void> {
        assert(this.project);
        const projectRootPath = this.project.getWorkspaceFolder().uri.fsPath;
        const expoHelper = new ExponentHelper(projectRootPath, projectRootPath);
        const isExpo = await expoHelper.isExpoManagedApp(true);

        if (isExpo) {
            const fs = new FileSystem();
            const exists = await fs.exists(`${projectRootPath}/app.json`);
            if (exists) {
                try {
                    await vscode.env.openExternal(vscode.Uri.parse(""));
                    // await new CommandExecutor(this.nodeModulesRoot, projectRootPath)
                    //     .executeToString("eas build:configure --platform all")
                    //     .then(res);

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
        }
    }
}
