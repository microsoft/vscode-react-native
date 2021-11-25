// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.

import {
    createNotFoundMessage,
    createVersionErrorMessage,
    executeCommand,
    normizeStr,
} from "../util";
import * as semver from "semver";
import { CategoryE, ValidationI, ValidationResultT } from "./types";
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
    const reg = /version "(.*?)"( |$)/gi;
    // something like 1.8.0
    const version = semver.coerce(reg.exec(text)?.[1]);

    if (!version) {
        return {
            status: "failure",
            comment: createVersionErrorMessage("label"),
        };
    }

    const isOlder = semver.lt(version, "1.8.0");

    if (isOlder) {
        return {
            status: "partial-success",
            comment: `Detected version is older than 1.8.0. Please install ${label} 8 in case of errors`,
        };
    }

    const isNewer = semver.gt(version, "1.12.0");

    if (isNewer) {
        return {
            status: "partial-success",
            comment:
                "Detected version is newer than 1.12.0 " +
                `Please install ${label} 8 in case of errors`,
        };
    }

    return { status: "success" };
}

const main: ValidationI = {
    label,
    description: toLocale("JavaCheckDescription", "Required as part of Anrdoid SDK"),
    category: CategoryE.Android,
    exec: test,
};

export default main;
