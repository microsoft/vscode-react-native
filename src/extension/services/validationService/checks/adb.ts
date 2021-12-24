// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.

import {
    basicCheck,
    createNotFoundMessage,
    createVersionErrorMessage,
    parseVersion,
} from "../util";
import { ValidationCategoryE, IValidation, ValidationResultT } from "./types";
import * as nls from "vscode-nls";

nls.config({
    messageFormat: nls.MessageFormat.bundle,
    bundleFormat: nls.BundleFormat.standalone,
})();

const toLocale = nls.loadMessageBundle();

const label = "ADB";

async function test(): Promise<ValidationResultT> {
    const result = await basicCheck({
        command: "adb",
        versionRange: "30.0.0",
        getVersion: parseVersion.bind(null, "adb --version", /^.*\n.*version (.*?)( |$|\n)/gi),
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
            status: "partial-success",
            comment:
                "Detected version is older than 30.0.0. " +
                "Please update SDK tools in case of errors",
        };
    }

    return { status: "success" };
}

const adbAndroid: IValidation = {
    label,
    description: toLocale(
        "AdbCheckAndroidDescription",
        "Required for app installition. Minimal version is 12",
    ),
    category: ValidationCategoryE.Android,
    exec: test,
};

const adbExpo: IValidation = {
    label,
    description: toLocale(
        "AdbCheckExpoDescription",
        "Required for correct extension integration with Expo",
    ),
    category: ValidationCategoryE.Expo,
    exec: test,
};

export { adbAndroid, adbExpo };
