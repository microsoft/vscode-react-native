// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.

import * as cp from "child_process";
import { promisify } from "util";
import * as nls from "vscode-nls";
nls.config({
    messageFormat: nls.MessageFormat.bundle,
    bundleFormat: nls.BundleFormat.standalone,
})();

export const toLocale = nls.loadMessageBundle();

export const executeCommand = promisify(cp.exec);
export const normizeStr = (str: string): string => str.replace(/\r\n/g, "\n");

export const createNotFoundMessage = (str: string): string =>
    `Command not found. Make sure ${str} is installed`;
export const createVersionErrorMessage = (str: string): string =>
    `Version check failed. Make sure ${str} is working correctly`;

// change typescript lib to es2019 ?
export const fromEntries = <T = any>(
    entries: Iterable<readonly [PropertyKey, T]>,
): { [k: string]: T } =>
    [...entries].reduce((obj, [key, val]) => {
        obj[key] = val;
        return obj;
    }, {});

// export const flatten = (ary: any[]): unknown[] =>
