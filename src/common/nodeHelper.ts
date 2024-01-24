// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.

import { ChildProcess } from "./node/childProcess";

export async function getNodeVersion() {
    return await new ChildProcess().execToString("node -v");
}
