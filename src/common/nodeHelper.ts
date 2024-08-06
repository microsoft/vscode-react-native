// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.

import { ChildProcess } from "./node/childProcess";

export async function getNodeVersion(projectPath: string, env: object) {
    try {
        return await new ChildProcess().execToString("node -v", { cwd: projectPath, env });
    } catch (error) {
        return "";
    }
}
