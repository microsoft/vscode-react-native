// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.

import * as fs from "fs";
import * as path from "path";
import * as Q from "q";

import {PlistBuddy} from "./plistBuddy";
import {Node} from "../../common/node/node";
import {Log} from "../../common/log/log";

import {TelemetryHelper} from "../../common/telemetryHelper";

export class SimulatorPlist {
    private projectRoot: string;

    constructor(projectRoot: string) {
        this.projectRoot = projectRoot;
    }

    public findPlistFile(): Q.Promise<string> {

        return Q.all<any>([
            new PlistBuddy().getBundleId(this.projectRoot), // Find the name of the application
            new Node.ChildProcess().exec("xcrun simctl getenv booted HOME").outcome]) // Find the path of the simulator we are running
            .spread((bundleId: string, pathBuffer: Buffer) => {
                const pathBefore = path.join(pathBuffer.toString().trim(), "Containers", "Data", "Application");
                const pathAfter = path.join("Library", "Preferences", `${bundleId}.plist`);

                // Look through $SIMULATOR_HOME/Containers/Data/Application/*/Library/Preferences to find $BUNDLEID.plist
                return Q.nfcall(fs.readdir, pathBefore).then((apps: string[]) => {
                    const mockableFS = new Node.FileSystem();
                    const plistCandidates = apps.map((app: string) => path.join(pathBefore, app, pathAfter)).filter(mockableFS.existsSync);
                    if (plistCandidates.length === 0) {
                        throw new Error(`Unable to find plist file for ${bundleId}`);
                    } else if (plistCandidates.length > 1) {
                        TelemetryHelper.sendSimpleEvent("multipleDebugPlistFound");
                        Log.logWarning("Multiple plist candidates found. Application may not be in debug mode");
                    }

                    return plistCandidates[0];
                });
            });
    }
}