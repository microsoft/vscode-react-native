// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.

import { executeCommand, normizeStr } from "../util";
import * as semver from "semver";
import { CategoryE, ValidationI, ValidationResultT } from "./types";

async function nodeTest(): ValidationResultT {
    const command = "node --version";
    const data = await executeCommand(command);

    const text = normizeStr(data.stdout).split("\n")[0];
    const version = semver.coerce(text);

    if (!version) {
        return {
            status: "failure",
            comment: "Version check failed. Is NodeJS insalled?",
        };
    }

    const isOlder = semver.lt(version, "12.0.0");

    return isOlder
        ? {
              status: "failure",
              comment:
                  "Detected version is older than 12.0.0 " +
                  "Minimal required version is 12.0.0. Please update your NodeJS installation",
          }
        : {
              status: "success",
          };
}

const main: ValidationI = {
    label: "Node.JS",
    description: "Required for code execution. Minimal version is 12",
    category: CategoryE.Common,
    exec: nodeTest,
};

export default main;
