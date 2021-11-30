// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.

/* eslint-disable */

import { TextDecoder } from "util";
import { Base64 } from "js-base64";

/**
 * @preserve
 * Start region: the code is borrowed from https://github.com/facebook/flipper/blob/v0.79.1/desktop/plugins/network/chunks.tsx#L12-L28
 *
 * Copyright (c) Facebook, Inc. and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * @format
 */

export function combineBase64Chunks(chunks: string[]): string {
    const byteArray = chunks.map(
        b64Chunk => Uint8Array.from(Base64.atob(b64Chunk), c => c.charCodeAt(0)).buffer,
    );
    const size = byteArray.map(b => b.byteLength).reduce((prev, curr) => prev + curr, 0);
    const buffer = new Uint8Array(size);
    let offset = 0;
    for (let i = 0; i < byteArray.length; i++) {
        buffer.set(new Uint8Array(byteArray[i]), offset);
        offset += byteArray[i].byteLength;
    }
    const data = new TextDecoder("utf-8").decode(buffer);
    return data;
}

/**
 * @preserve
 * End region: https://github.com/facebook/flipper/blob/v0.79.1/desktop/plugins/network/chunks.tsx#L12-L28
 */
