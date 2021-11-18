// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.

// also check out this cool things
// https://www.npmjs.com/package/envinfo // does not list all required info
// https://www.npmjs.com/package/command-exists // might find its use later on

import adb from "./adb";
import emulator from "./emulator";
import env from "./env";
import java from "./java";
import nodeJs from "./nodeJS";
import gradle from "./gradle";

// it's infered!
// eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
export const getChecks = () => {
    const checks = [adb, emulator, env, java, nodeJs, gradle] as const;
    // if some checks become obsolete (e.g. no need to check both npm and yarn) - write logic here
    return checks;
};
