// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.

import * as os from "os";
import * as nls from "vscode-nls";
import * as semver from "semver";
import { createVersionErrorMessage } from "../util";
import { IValidation, ValidationCategoryE, ValidationResultT } from "./types";

nls.config({
    messageFormat: nls.MessageFormat.bundle,
    bundleFormat: nls.BundleFormat.standalone,
})();
const toLocale = nls.loadMessageBundle();

const label = "Windows version > 10.0.16299.0";

async function test(): Promise<ValidationResultT> {
    const version = os.release();

    if (semver.gte(version, "10.0.16299")) {
        return {
            status: "success",
        };
    }
    return {
        status: "failure",
        comment: createVersionErrorMessage(label),
    };
}

const main: IValidation = {
    label,
    platform: ["win32"],
    description: toLocale("RNWBuildTestDescription", "Required for running RNW apps"),
    category: ValidationCategoryE.Windows,
    exec: test,
};

export default main;
