// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.

import * as cp from "child_process";
import { promisify } from "util";
import * as semver from "semver";
import * as commandExists from "command-exists";

export const executeCommand = promisify(cp.exec);
export const normizeStr = (str: string): string => str.replace(/\r\n/g, "\n");

export const createNotFoundMessage = (str: string): string =>
    `Command not found. Make sure ${str} is installed`;
export const createVersionErrorMessage = (str: string): string =>
    `Version check failed. Make sure ${str} is working correctly`;

interface IBasicCheckResult {
    exists: boolean;
    /**
     *  - 0 : within range
     *  - 1 : gt range
     *  - -1 : lt range*/
    versionCompare?: 0 | 1 | -1;
}

export const basicCheck = async (arg: {
    command: string;
    getVersion?: () => Promise<string | null | undefined>;
    versionRange?: semver.Range | string;
}): Promise<IBasicCheckResult> => {
    const result = {
        exists: true,
    } as IBasicCheckResult;

    if (!commandExists.sync(arg.command)) {
        result.exists = false;
        return result;
    }

    const version = await arg.getVersion?.();

    if (!version) {
        return result;
    }

    if (!arg.versionRange) {
        result.versionCompare = 0;
        return result;
    }

    result.versionCompare = semver.gtr(version, arg.versionRange)
        ? 1
        : semver.ltr(version, arg.versionRange)
        ? -1
        : 0;

    return result;
};

/** Run command and parse output with regex. Get first capturing group. If command does not exist - throws an error. */
export const parseVersion = async (
    command: string,
    reg?: RegExp,
    prop: "stdout" | "stderr" = "stdout",
): Promise<semver.SemVer | null> => {
    const data = await executeCommand(command).catch(() => {});

    if (!data) {
        return null;
    }

    const text = normizeStr(data[prop]);
    return semver.coerce(reg ? reg.exec(text)?.[1] : text);
};

// change typescript lib to es2019 ?
export const fromEntries = <T = any, J extends PropertyKey = PropertyKey>(
    entries: Iterable<readonly [J, T]>,
): Record<J, T> =>
    [...entries].reduce((obj, [key, val]) => {
        obj[key] = val;
        return obj;
    }, {} as Record<J, T>);

// export const flatten = (ary: any[]): unknown[] =>
