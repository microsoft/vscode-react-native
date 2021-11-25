// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.

import { createNotFoundMessage } from "../util";
import { CategoryE, ValidationI, ValidationResultT } from "./types";
import * as cexists from "command-exists";
import * as nls from "vscode-nls";

nls.config({
    messageFormat: nls.MessageFormat.bundle,
    bundleFormat: nls.BundleFormat.standalone,
})();

const toLocale = nls.loadMessageBundle();

const label = "Expo CLI";

async function test(): Promise<ValidationResultT> {
    if (!cexists.sync("expo-cli")) {
        return {
            status: "failure",
            comment: createNotFoundMessage(label),
        };
    }

    return {
        status: "success",
    };
}

const main: ValidationI = {
    label,
    description: toLocale(
        "ExpoCliTestDescription",
        "Required for installing and managing Expo applications",
    ),
    category: CategoryE.Expo,
    exec: test,
};

export default main;
