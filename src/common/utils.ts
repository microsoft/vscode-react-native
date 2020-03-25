// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.

import * as path from "path";

export function getFileNameWithoutExtension(fileName: string) {
    return path.basename(fileName, path.extname(fileName));
}
