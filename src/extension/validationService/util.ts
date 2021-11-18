// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.

import * as cp from "child_process";
import { promisify } from "util";

export const executeCommand = promisify(cp.exec);
export const normizeStr = (str: string): string => str.replace(/\r\n/g, "\n");

// change typescript lib to es2019 ?
export const fromEntries = <T = any>(
    entries: Iterable<readonly [PropertyKey, T]>,
): { [k: string]: T } =>
    [...entries].reduce((obj, [key, val]) => {
        obj[key] = val;
        return obj;
    }, {});

// export const flatten = (ary: any[]): unknown[] =>
