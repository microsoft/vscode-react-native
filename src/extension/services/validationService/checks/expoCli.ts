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

const label = "Expo CLI";

async function test(): Promise<ValidationResultT> {
    const result = await basicCheck({
        command: "expo-cli",
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
    description: toLocale(
        "ExpoCliTestDescription",
        "Required for installing and managing Expo applications",
    ),
    category: ValidationCategoryE.Expo,
    exec: test,
};

export default main;
