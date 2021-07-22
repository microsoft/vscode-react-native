// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.

const path = require("path");

exports.connect = function (outPath, handle) {
    const bootstrapPath = path.join(outPath, "bootstrap-amd.js");
    const { load } = require(bootstrapPath);
    return new Promise((c, e) => load("vs/platform/driver/node/driver", ({ connect }) => connect(handle).then(c, e), e));
};