// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.

import * as crypto from "crypto";

export class Crypto {
    public hash(data: string): string {
        const hasher = crypto.createHash("sha256");
        hasher.update(data);
        return hasher.digest("hex");
    }
}
