// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.

/* This setup is just to install the source-map-support, so we'll get TypeScript stack traces
   for the tests */
import * as fs from "fs";

// source-map-support has a bug that crashes some of our tests. We fix it: https://github.com/evanw/node-source-map-support/issues/131
const moduleLocation = require.resolve("source-map-support/source-map-support.js");
const originalCode = "column -= 62;";
const replacementCode = "if (column > 63) { column -= 62; }";
const contents = fs.readFileSync(moduleLocation, "utf8");
const fixedContents = contents.replace(originalCode, replacementCode);
fs.writeFileSync(moduleLocation, fixedContents);

// Then we load the module
import * as sourceMapSupport from "source-map-support";
sourceMapSupport.install(); // Enable stack traces translation to typescript
