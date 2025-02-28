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
import { SettingsHelper } from "../settingsHelper";

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
        const PNPM_PACKAGE_NAME = ".pnpm";
        const projectRootPath = this.project.getWorkspaceFolder().uri.fsPath;

        const packageJsonPath = findFileInFolderHierarchy(projectRootPath, "package.json");
        const rnVersion = packageJsonPath
            ? JSON.parse(fs.readFileSync(packageJsonPath, "utf-8")).dependencies["react-native"]
            : null;

        const OPN_PACKAGE_NAME =
            semver.gte(rnVersion, "0.60.0") || ProjectVersionHelper.isCanaryVersion(rnVersion)
                ? "open"
                : "opn";

        const pnpmModulesPath = path.join(
            projectRootPath,
            NODE_MODULES_FODLER_NAME,
            PNPM_PACKAGE_NAME,
        );
        const isPnpmProject =
            fs.existsSync(pnpmModulesPath) && SettingsHelper.getPackageManager() === "pnpm";
        let openModulePath = "";

        if (isPnpmProject) {
            const modules = fs.readdirSync(pnpmModulesPath);
            const openRegex = /^open@/;
            const openModule = modules.find(module => openRegex.test(module));
            if (openModule) {
                openModulePath = path.join(
                    pnpmModulesPath,
                    openModule,
                    NODE_MODULES_FODLER_NAME,
                    OPN_PACKAGE_NAME,
                );
            }
        } else {
            openModulePath = path.resolve(
                projectRootPath,
                NODE_MODULES_FODLER_NAME,
                OPN_PACKAGE_NAME,
            );
        }

        if (fs.existsSync(openModulePath)) {
            const mainFilePath = path.resolve(openModulePath, "open-main.js");
            if (fs.existsSync(mainFilePath)) {
                try {
                    await fs.unlinkSync(mainFilePath);
                } catch {
                    logger.error(
                        localize("FailedToDeleteMainFile", "Failed to delete open-main.js file."),
                    );
                }
            } else {
                logger.info(
                    localize(
                        "NotFindMainFile",
                        "Not find open-main.js file in open module, skip main file deleting.",
                    ),
                );
            }

            const packageFilePath = path.resolve(openModulePath, "package.json");
            const packageJson = JSON.parse(fs.readFileSync(packageFilePath, "utf-8"));
            if (packageJson.main == "open-main.js") {
                try {
                    delete packageJson.main;
                    await fs.writeFileSync(
                        packageFilePath,
                        JSON.stringify(<Record<string, any>>packageJson),
                    );
                } catch {
                    logger.error(localize("FailedToDeleteEntry", "Failed to delete main enrty."));
                }
            } else {
                logger.info(
                    localize(
                        "NotFindMainEntry",
                        "Not find main entry in package.json file, skip entry deleting.",
                    ),
                );
            }
            logger.info(localize("CompleteOpenModuleCleaUp", "Open module clean up is complete."));
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
