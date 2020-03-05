// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.

import * as path from "path";
import * as fs from "fs";

export function getExtensionVersion() {
    const projectRoot = path.join(__dirname, "..", "..");
    return JSON.parse(fs.readFileSync(path.join(projectRoot, "package.json"), "utf-8")).version;
}

export function generateRandomPortNumber() {
    return Math.round(Math.random() * 40000 + 3000);
}
