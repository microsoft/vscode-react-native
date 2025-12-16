// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.

import * as path from "path";
import * as nls from "vscode-nls";
import {
    basicCheck,
    createNotFoundMessage,
    createVersionErrorMessage,
    parseVersion,
} from "../util";
import { ProjectVersionHelper } from "../../../../common/projectVersionHelper";
import { ValidationCategoryE, IValidation, ValidationResultT } from "./types";

nls.config({
    messageFormat: nls.MessageFormat.bundle,
    bundleFormat: nls.BundleFormat.standalone,
})();

const toLocale = nls.loadMessageBundle();

const label = "Node.JS";

async function test(): Promise<ValidationResultT> {
    // Determine RN-required Node range if available
    const projectRoot = process.cwd();
    const nodeModulesRoot = path.join(projectRoot, "node_modules");
    const rnNodeRange = await ProjectVersionHelper.getReactNativeRequiredNodeRange(
        projectRoot,
        nodeModulesRoot,
    );

    const requiredRange = rnNodeRange || "12.0.0";

    const result = await basicCheck({
        command: "node",
        versionRange: requiredRange,
        getVersion: parseVersion.bind(null, "node --version"),
    });

    if (!result.exists) {
        return {
            status: "failure",
            comment: createNotFoundMessage(label),
        };
    }

    if (result.versionCompare === undefined) {
        return {
            status: "failure",
            comment: createVersionErrorMessage(label),
        };
    }

    if (result.versionCompare === -1) {
        return {
            status: "failure",
            comment: rnNodeRange
                ? `Detected Node.js version is incompatible with React Native. Required range: ${requiredRange}. Please install a supported Node.js version for your project's React Native.`
                : "Detected version is older than 12.0.0 Minimal required version is 12.0.0. Please update your Node.JS installation",
        };
    }

    return { status: "success" };
}

const main: IValidation = {
    label,
    description: toLocale(
        "NodejsCheckDescription",
        "Required for code execution. Uses React Native's required Node range when available; otherwise minimal version is 12",
    ),
    category: ValidationCategoryE.Common,
    exec: test,
};

export default main;
