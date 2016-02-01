// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.

import * as fs from "fs";
import * as path from "path";
import * as Q from "q";

import {Node} from "../../utils/node/node";

export class IOSUtils {
    private static plistBuddyExecutable = "/usr/libexec/PlistBuddy";
    /*
        Find a .xcodeproj file in the ios folder to be used as the project to build
    */
    public findProjectFile(projectRoot: string): Q.Promise<string> {
        const iosPath = path.join(projectRoot, "ios");
        return Q.nfcall(fs.readdir, iosPath).then((files: string[]) => {
            const projFiles = files.filter((file: string) => path.extname(file) === ".xcodeproj");
            if (projFiles.length === 0) {
                throw new Error("Unable to find any xcodeproj files to build.");
            }
            return projFiles[0];
        });
    }

    public getBundleId(projectRoot: string, simulator: boolean = true): Q.Promise<string> {
        return this.findProjectFile(projectRoot).then((projectFile: string) => {
            const appName = path.basename(projectFile, path.extname(projectFile));
            const infoPlistPath = path.join(projectRoot, "ios", "build", "Build", "Products", simulator ? "Debug-iphonesimulator" : "Debug-iphoneos", `${appName}.app`, "Info.plist");

            return new Node.ChildProcess().exec(`${IOSUtils.plistBuddyExecutable} -c Print:CFBundleIdentifier '${infoPlistPath}'`).outcome;
        }).then((result: Buffer) => {
            const appBundleId = result.toString().trim();
            return appBundleId;
        });
    }

    public setPlistProperty(plistFile: string, property: string, value: string): Q.Promise<void> {
        const nodeChildProc = new Node.ChildProcess();

        // Attempt to set the value, and if it fails due to the key not existing attempt to create the key
        return nodeChildProc.exec(`${IOSUtils.plistBuddyExecutable} -c 'Set ${property} ${value}' ${plistFile}`).outcome.fail(() =>
            nodeChildProc.exec(`${IOSUtils.plistBuddyExecutable} -c 'Add ${property} string ${value}' ${plistFile}`).outcome
        ).then(() => {});
    }
}