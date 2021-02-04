// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.

import * as cp from "child_process";
import { SmokeTestLogger } from "./smokeTestLogger";

export class MacOSTestHelper {
    public static terminateMacOSapp(appName: string): void {
        SmokeTestLogger.info(`*** Searching for ${appName} macOS application process`);
        const searchForMacOSappProcessCommand = `ps -ax | grep ${appName}`;
        const searchResults = cp.execSync(searchForMacOSappProcessCommand).toString();
        // An example of the output from the command above:
        // 40943 ??         4:13.97 node /Users/user/Documents/rn_for_mac_proj/node_modules/.bin/react-native start --port 8081
        // 40959 ??         0:10.36 /Users/user/.nvm/versions/node/v10.19.0/bin/node /Users/user/Documents/rn_for_mac_proj/node_modules/metro/node_modules/jest-worker/build/workers/processChild.js
        // 41004 ??         0:21.34 /Users/user/Library/Developer/Xcode/DerivedData/rn_for_mac_proj-ghuavabiztosiqfqkrityjoxqfmv/Build/Products/Debug/rn_for_mac_proj.app/Contents/MacOS/rn_for_mac_proj
        // 75514 ttys007    0:00.00 grep --color=auto --exclude-dir=.bzr --exclude-dir=CVS --exclude-dir=.git --exclude-dir=.hg --exclude-dir=.svn rn_for_mac_proj
        SmokeTestLogger.info(
            `*** Searching for ${appName} macOS application process: results ${JSON.stringify(
                searchResults,
            )}`,
        );

        if (searchResults) {
            const processIdRgx = /(^\d*)\s\?\?/g;
            //  We are looking for a process whose path contains the "appName.app" part
            const processData = searchResults
                .split("\n")
                .find(str => str.includes(`${appName}.app`));

            if (processData) {
                const match = processIdRgx.exec(processData);
                if (match && match[1]) {
                    SmokeTestLogger.info(
                        `*** Terminating ${appName} macOS application process with PID ${match[1]}`,
                    );
                    const terminateMacOSappProcessCommand = `kill ${match[1]}`;
                    cp.execSync(terminateMacOSappProcessCommand);
                }
            }
        }
    }
}
