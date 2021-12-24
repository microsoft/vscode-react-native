// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.

import { basicCheck, createNotFoundMessage } from "../util";
import { ValidationCategoryE, IValidation, ValidationResultT } from "./types";
import * as nls from "vscode-nls";

nls.config({
    messageFormat: nls.MessageFormat.bundle,
    bundleFormat: nls.BundleFormat.standalone,
})();

const toLocale = nls.loadMessageBundle();

const label = "XCodeBuild";

async function test(): Promise<ValidationResultT> {
    const result = await basicCheck({
        command: "xcodebuild",
    });

    if (!result.exists) {
        return {
            status: "failure",
            comment: createNotFoundMessage(label),
        };
    }

    return { status: "success" };
}

const main: IValidation = {
    label,
    platform: ["darwin"],
    description: toLocale("XCodeBuildTestDescription", "Required for building iOS apps"),
    category: ValidationCategoryE.iOS,
    exec: test,
};

export default main;
