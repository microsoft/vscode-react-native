// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.

// also check out this cool things
// https://www.npmjs.com/package/envinfo // does not list all required info
// https://www.npmjs.com/package/command-exists // might find its use later on

import { PromiseUtil } from "../../../../common/node/promise";
import { adbAndroid, adbExpo } from "./adb";
import cocoaPods from "./cocoaPods";
import emulator from "./emulator";
import { androidHome } from "./env";
import gradle from "./gradle";
import java from "./java";
import nodeJs from "./nodeJS";
import npm from "./npm";
import watchman from "./watchman";
import iosDeploy from "./iosDeploy";
import { xcodeBuild, xcodeBuildVersionRNmacOS } from "./xcodebuild";
import expoCli from "./expoCli";
import devmode from "./devmode";
import visualStudio from "./visualStudio";
import longPath from "./longPath";
import windows from "./windows";
import dotnet from "./dotnet";
import xcodecli from "./xcodecli";
import macos from "./macos";

import { IValidation } from "./types";

export const getChecks = (): IValidation[] => {
    // if some checks become obsolete (e.g. no need to check both npm and yarn) - write logic here

    const checks = [
        iosDeploy,
        adbAndroid,
        adbExpo,
        emulator,
        androidHome,
        java,
        nodeJs,
        gradle,
        cocoaPods,
        npm,
        watchman,
        expoCli,
        devmode,
        visualStudio,
        longPath,
        windows,
        dotnet,
        xcodecli,
        macos,
        xcodeBuild,
        xcodeBuildVersionRNmacOS,
    ] as const;

    checks.forEach(it => {
        it.exec = PromiseUtil.promiseCacheDecorator(it.exec);
    });

    return checks.filter(it => (it.platform ? it.platform.includes(process.platform) : true));
};
