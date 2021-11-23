// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.

import { createNotFoundMessage, toLocale } from "../util";
import { CategoryE, ValidationI, ValidationResultT } from "./types";
import * as cexists from "command-exists";

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

const main: ValidationI = {
    label,
    platform: ["darwin"],
    description: toLocale("WatchmanTestDescription", "Required for watching file changes"),
    category: CategoryE.iOS,
    exec: test,
};

export default main;
