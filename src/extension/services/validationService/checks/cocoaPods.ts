// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.

import * as nls from "vscode-nls";
import { basicCheck, createNotFoundMessage } from "../util";
import { ValidationCategoryE, IValidation, ValidationResultT } from "./types";

nls.config({
    messageFormat: nls.MessageFormat.bundle,
    bundleFormat: nls.BundleFormat.standalone,
})();

const toLocale = nls.loadMessageBundle();

const label = "CocoaPods";

async function test(): Promise<ValidationResultT> {
    const result = await basicCheck({
        command: "pod",
    });

    if (!result.exists) {
        return {
            status: "failure",
            comment: createNotFoundMessage(label),
        };
    }

    return {
        status: "success",
    };
}

const main: IValidation = {
    label,
    platform: ["darwin"],
    description: toLocale(
        "CocoaPodsTestDescription",
        "Required for managing library dependencies of XCode projects",
    ),
    category: ValidationCategoryE.iOS,
    exec: test,
};

export default main;
