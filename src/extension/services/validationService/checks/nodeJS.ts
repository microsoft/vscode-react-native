// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.

import * as semver from "semver";
import * as cexists from "command-exists";
import * as nls from "vscode-nls";
import {
    createNotFoundMessage,
    createVersionErrorMessage,
    executeCommand,
    normizeStr,
} from "../util";
import { ValidationCategoryE, IValidation, ValidationResultT } from "./types";

nls.config({
    messageFormat: nls.MessageFormat.bundle,
    bundleFormat: nls.BundleFormat.standalone,
})();

const toLocale = nls.loadMessageBundle();

const label = "Node.JS";

async function test(): Promise<ValidationResultT> {
    if (!cexists.sync("node")) {
        return {
            status: "failure",
            comment: createNotFoundMessage(label),
        };
    }
    const command = "node --version";
    const data = await executeCommand(command);

    const text = normizeStr(data.stdout).split("\n")[0];
    const version = semver.coerce(text);

    if (!version) {
        return {
            status: "failure",
            comment: createVersionErrorMessage(label),
        };
    }

    const isOlder = semver.lt(version, "12.0.0");

    return isOlder
        ? {
              status: "failure",
              comment:
                  "Detected version is older than 12.0.0 " +
                  `Minimal required version is 12.0.0. Please update your ${label} installation`,
          }
        : {
              status: "success",
          };
}

const main: IValidation = {
    label,
    description: toLocale(
        "NodejsCheckDescription",
        "Required for code execution. Minimal version is 12",
    ),
    category: ValidationCategoryE.Common,
    exec: test,
};

export default main;
