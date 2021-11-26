// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.

// also check out this cool things
// https://www.npmjs.com/package/envinfo // does not list all required info
// https://www.npmjs.com/package/command-exists // might find its use later on

import { adbAndroid, adbExpo } from "./adb";
import cocoaPods from "./cocoaPods";
import emulator from "./emulator";
import env from "./env";
import gradle from "./gradle";
import java from "./java";
import nodeJs from "./nodeJS";
import npm from "./npm";
import watchman from "./watchman";
import xcodebuild from "./xcodebuild";
import expoCli from "./expoCli";
import { IValidation } from "./types";

export const getChecks = (): IValidation[] => {
    // if some checks become obsolete (e.g. no need to check both npm and yarn) - write logic here

    const checks = [
        adbAndroid,
        adbExpo,
        emulator,
        env,
        java,
        nodeJs,
        gradle,
        cocoaPods,
        npm,
        watchman,
        xcodebuild,
        expoCli,
    ] as const;

    return checks.filter(it => (it.platform ? it.platform.includes(process.platform) : true));
};
