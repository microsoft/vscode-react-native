// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.

import * as fs from "fs";
import * as path from "path";

// source-map-support has a bug that crashes some of our tests. We fix it
const moduleRelativeLocation = "../../../node_modules/source-map-support/source-map-support.js";
const moduleLocation = path.join(__dirname, moduleRelativeLocation);
const originalCode = "column -= 62;";
const replacementCode = "if (column > 63) { column -= 62; }";
const contents = fs.readFileSync(moduleLocation, "utf8");
const fixedContents = contents.replace(originalCode, replacementCode);
fs.writeFileSync(moduleLocation, fixedContents);

// Then we load the module
import * as sourceMapSupport from "source-map-support";
sourceMapSupport.install(); // Enable stack traces translation to typescript
