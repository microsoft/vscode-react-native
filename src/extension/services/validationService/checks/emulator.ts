// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.

import * as nls from "vscode-nls";
import {
    basicCheck,
    createNotFoundMessage,
    createVersionErrorMessage,
    parseVersion,
} from "../util";
import { ValidationCategoryE, IValidation, ValidationResultT } from "./types";

nls.config({
    messageFormat: nls.MessageFormat.bundle,
    bundleFormat: nls.BundleFormat.standalone,
})();

const toLocale = nls.loadMessageBundle();

const label = "Android Emulator";

async function test(): Promise<ValidationResultT> {
    const result = await basicCheck({
        command: "emulator",
        versionRange: "30.0.0",
        getVersion: parseVersion.bind(null, "emulator -version", /version (.*?)( |$)/gi),
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

const main: IValidation = {
    label,
    description: toLocale(
        "EmulatorCheckDescription",
        "Required for working with Android emulators",
    ),
    category: ValidationCategoryE.Android,
    exec: test,
};

export default main;
