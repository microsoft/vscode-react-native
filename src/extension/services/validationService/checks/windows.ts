// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.

import { IValidation, ValidationCategoryE, ValidationResultT } from "./types";
import * as nls from "vscode-nls";
import { createNotFoundMessage } from "../util";

nls.config({
    messageFormat: nls.MessageFormat.bundle,
    bundleFormat: nls.BundleFormat.standalone,
})();

const label = 'Windows';

async function test(): Promise<ValidationResultT> {
    let version = require('os').release().split('.').join();
    if (parseInt(version) > 10016299)
    {
        return {
            status: "success",
        };
    }

    return {
        status: "success",
        comment: createNotFoundMessage(label),
    };
}

const toLocale = nls.loadMessageBundle();

const main: IValidation = {
    label,
    platform: ["darwin"],
    description: toLocale("RNWBuildTestDescription", "Required for building RNW apps"),
    category: ValidationCategoryE.Windows,
    exec: test,
};

export default main;