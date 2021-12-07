// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.

import { createNotFoundMessage } from "../util";
import { ValidationCategoryE, IValidation, ValidationResultT } from "./types";
import * as cexists from "command-exists";
import * as nls from "vscode-nls";

nls.config({
    messageFormat: nls.MessageFormat.bundle,
    bundleFormat: nls.BundleFormat.standalone,
})();

const toLocale = nls.loadMessageBundle();

const label = "Watchman";

async function test(): Promise<ValidationResultT> {
    if (!cexists.sync("watchman")) {
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
    platform: ["darwin", "android"],
    description: toLocale("WatchmanTestDescription", "Required for watching file changes"),
    category: ValidationCategoryE.Common,
    exec: test,
};

export default main;
