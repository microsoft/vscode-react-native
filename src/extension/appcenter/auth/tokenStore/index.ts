// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.

import { TokenStore } from "./tokenStore";
import { createFileTokenStore } from "./fileTokenStore";
import { getProfileDir } from "../profile/getProfileDir";
import * as path from "path";
import * as fs from "fs";

export * from "./tokenStore";
export const tokenFile = "VSCodeAppCenterTokens.json";

let store: TokenStore;

// Currently only support file-base token store
const tokenFilePath = path.join(getProfileDir(), tokenFile);
if (!fs.existsSync(tokenFilePath)) {
    if (!fs.existsSync(getProfileDir())) {
        fs.mkdirSync(getProfileDir());
    }
    fs.writeFileSync(tokenFilePath, /* create empty */ "");
}
store = createFileTokenStore(tokenFilePath);
export const tokenStore = store;

