// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.

import * as assert from "assert";
import * as path from "path";
import * as fs from "fs";
import * as semver from "semver";
import * as nls from "vscode-nls";
import { OutputChannelLogger } from "../log/OutputChannelLogger";
import { ErrorHelper } from "../../common/error/errorHelper";
import { InternalErrorCode } from "../../common/error/internalErrorCode";
import { ProjectVersionHelper } from "../../common/projectVersionHelper";
import { findFileInFolderHierarchy } from "../../common/extensionHelper";
import { ReactNativeCommand } from "./util/reactNativeCommand";

nls.config({
    messageFormat: nls.MessageFormat.bundle,
    bundleFormat: nls.BundleFormat.standalone,
})();

const localize = nls.loadMessageBundle();
const logger = OutputChannelLogger.getMainChannel();

export class RevertOpenModule extends ReactNativeCommand {
    nodeModulesRoot: string;
    codeName = "revertOpenModule";
    label = "Revert extension input in open package module";
    error = ErrorHelper.getInternalError(InternalErrorCode.FailedToRevertOpenModule);

    async baseFn(): Promise<void> {
        assert(this.project);
        const NODE_MODULES_FODLER_NAME = "node_modules";
        const projectRootPath = this.project.getWorkspaceFolder().uri.fsPath;

        const packageJsonPath = findFileInFolderHierarchy(projectRootPath, "package.json");
        const rnVersion = packageJsonPath
            ? JSON.parse(fs.readFileSync(packageJsonPath, "utf-8")).dependencies["react-native"]
            : null;

        const OPN_PACKAGE_NAME =
            semver.gte(rnVersion, "0.60.0") || ProjectVersionHelper.isCanaryVersion(rnVersion)
                ? "open"
                : "opn";

        const openModulePath = path.resolve(
            projectRootPath,
            NODE_MODULES_FODLER_NAME,
            OPN_PACKAGE_NAME,
        );

        if (fs.existsSync(openModulePath)) {
        } else {
            logger.error(
                localize(
                    "NotFindOpenModule",
                    "Unable to find open module in your project. Please check it again.",
                ),
            );
        }
    }
}
