// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.

import {
    createNotFoundMessage,
    createVersionErrorMessage,
    executeCommand,
    normizeStr,
} from "../util";
import * as semver from "semver";
import { ValidationCategoryE, IValidation, ValidationResultT } from "./types";
import * as cexists from "command-exists";
import * as nls from "vscode-nls";

nls.config({
    messageFormat: nls.MessageFormat.bundle,
    bundleFormat: nls.BundleFormat.standalone,
})();

const toLocale = nls.loadMessageBundle();

const label = "Java";

async function test(): Promise<ValidationResultT> {
    if (!cexists.sync("java")) {
        return {
            status: "failure",
            comment: createNotFoundMessage(label),
        };
    }

    const command = "java -version";

    const data = await executeCommand(command);

    // https://stackoverflow.com/questions/13483443/why-does-java-version-go-to-stderr
    // `java -version` goes to stderr...
    const text = normizeStr(data.stderr).split("\n")[0];
    // something like 1.8.0
    // example `java -version` output: java version "16.0.1" 2021-04-20
    const vOldReg = /version "(.*?)"( |$)/gi;
    // something like 11.0.12
    // this regex parses the output of `java --version`, which should not be required,
    // but let's leave it here just to be sure nothing breaks in future java versions
    // example `java --version` output: java 16.0.1 2021-04-20
    const vNewReg = /java (.*?)( |$)/gi;
    const version = semver.coerce(vOldReg.exec(text)?.[1] || vNewReg.exec(text)?.[1]);

    if (!version) {
        return {
            status: "failure",
            comment: createVersionErrorMessage("label"),
        };
    }

    // the fact that version format has changed after java8 does not
    // change this line, but it is something to keep in mind
    const isOlder = semver.lt(version, "1.8.0");

    if (isOlder) {
        return {
            status: "partial-success",
            comment: `Detected version is older than 1.8.0. Please install ${label} 8 in case of errors`,
        };
    }

    // const isNewer = semver.gt(version, "1.12.0");

    // if (isNewer) {
    //     return {
    //         status: "partial-success",
    //         comment:
    //             "Detected version is newer than 1.12.0 " +
    //             `Please install ${label} 8 in case of errors`,
    //     };
    // }

    return { status: "success" };
}

const main: IValidation = {
    label,
    description: toLocale("JavaCheckDescription", "Required as part of Anrdoid SDK"),
    category: ValidationCategoryE.Android,
    exec: test,
};

export default main;
