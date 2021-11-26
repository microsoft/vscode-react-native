// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.

import { createNotFoundMessage, createVersionErrorMessage, getVersion } from "../util";
import * as semver from "semver";
import { ValidationCategoryE, IValidation, ValidationResultT } from "./types";
import * as cexists from "command-exists";
import * as nls from "vscode-nls";

nls.config({
    messageFormat: nls.MessageFormat.bundle,
    bundleFormat: nls.BundleFormat.standalone,
})();

const toLocale = nls.loadMessageBundle();

const label = "ADB";

async function test(): Promise<ValidationResultT> {
    if (!cexists.sync("adb")) {
        return {
            status: "failure",
            comment: createNotFoundMessage(label),
        };
    }

    const version = await getVersion("adb --version", /^.*\n.*version (.*?)( |$|\n)/gi);

    if (!version) {
        return {
            status: "failure",
            comment: createVersionErrorMessage(label),
        };
    }

    const isOlder = semver.lt(version, "30.0.0");
    return isOlder
        ? {
              status: "partial-success",
              comment:
                  "Detected version is older than 30.0.0. " +
                  "Please update SDK tools in case of errors",
          }
        : {
              status: "success",
          };
}

const adbAndroid: IValidation = {
    label,
    description: toLocale(
        "AdbCheckAndroidDescription",
        "Required for app installition. Minimal version is 12",
    ),
    category: ValidationCategoryE.Android,
    exec: test,
};

const adbExpo: IValidation = {
    label,
    description: toLocale(
        "AdbCheckExpoDescription",
        "Required for correct extension integration with Expo",
    ),
    category: ValidationCategoryE.Expo,
    exec: test,
};

export { adbAndroid, adbExpo };
