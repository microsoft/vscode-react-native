// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.

import * as assert from "assert";
import * as nls from "vscode-nls";
import * as vscode from "vscode";
import { OutputChannelLogger } from "../log/OutputChannelLogger";
import { ErrorHelper } from "../../common/error/errorHelper";
import { InternalErrorCode } from "../../common/error/internalErrorCode";
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
            try {
                let id = null;
                await expoHelper.getExpoEasProjectId().then(result => {
                    id = result;
                });
                let owner = null;
                await expoHelper.getExpoEasProjectOwner().then(result => {
                    owner = result;
                });
                let name = null;
                await expoHelper.getExpoEasProjectName().then(result => {
                    name = result;
                });
                if (id == null || owner == null) {
                    const error = localize(
                        "ExpoProjectNotLinkToEAS",
                        "Your app not link to EAS project. Please run 'eas init' firstly to bind your app to EAS project.",
                    );
                    void vscode.window.showErrorMessage(error);
                    logger.error(error);
                } else if (name != null) {
                    // eslint-disable-next-line @typescript-eslint/restrict-template-expressions
                    const url = `https://expo.dev/accounts/${owner}/projects/${name}`;
                    await vscode.env.openExternal(vscode.Uri.parse(url));
                }
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
