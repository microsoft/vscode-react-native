// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.

import * as nls from "vscode-nls";
import { basicCheck, createNotFoundMessage } from "../util";
import { IValidation, ValidationCategoryE, ValidationResultT } from "./types";

nls.config({
    messageFormat: nls.MessageFormat.bundle,
    bundleFormat: nls.BundleFormat.standalone,
})();
const locale = nls.loadMessageBundle();

const label = "Xcode CLI";

async function test(): Promise<ValidationResultT> {
    const result = await basicCheck({
        command: "xcode-select",
    });
    if (result.exists) {
        return {
            status: "success",
        };
    }
    return {
        status: "failure",
        comment: createNotFoundMessage(label),
    };
}

const main: IValidation = {
    label,
    platform: ["darwin"],
    description: locale(
        "XcodeCLICheckDescription",
        "Required for building and testing RN macOS apps",
    ),
    category: ValidationCategoryE.macOS,
    exec: test,
};

export default main;
