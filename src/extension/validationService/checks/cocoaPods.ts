// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.

import { createNotFoundMessage, toLocale } from "../util";
import { CategoryE, ValidationI, ValidationResultT } from "./types";
import * as cexists from "command-exists";

const label = "CocoaPods";

async function test(): Promise<ValidationResultT> {
    if (!cexists.sync("gem")) {
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
    description: toLocale(
        "CocoaPodsTestDescription",
        "Required for managing library dependencies of XCode projects",
    ),
    category: CategoryE.iOS,
    exec: test,
};

export default main;
