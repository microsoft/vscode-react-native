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

const label = "ios-deploy";

async function test(): Promise<ValidationResultT> {
    const result = await basicCheck({
        command: "ios-deploy",
    });

    if (!result.exists) {
        return {
            status: "partial-success", // not necessary required
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
        "IosDeployTestDescription",
        "Required for installing your app on a physical device with the CLI",
    ),
    category: ValidationCategoryE.iOS,
    exec: test,
};

export default main;
