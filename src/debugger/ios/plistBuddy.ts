// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.

import * as path from "path";
import * as Q from "q";

import {Node} from "../../utils/node/node";
import {Xcodeproj} from "./xcodeproj";

export class PlistBuddy {
    private static plistBuddyExecutable = "/usr/libexec/PlistBuddy";

    public getBundleId(projectRoot: string, simulator: boolean = true): Q.Promise<string> {
        return new Xcodeproj().findXcodeprojFile(projectRoot).then((projectFile: string) => {
            const appName = path.basename(projectFile, path.extname(projectFile));
            const infoPlistPath = path.join(projectRoot, "ios", "build", "Build", "Products",
                simulator ? "Debug-iphonesimulator" : "Debug-iphoneos",
                `${appName}.app`, "Info.plist");

            return this.invokePlistBuddy("Print:CFBundleIdentifier", infoPlistPath);
        });
    }

    public setPlistProperty(plistFile: string, property: string, value: string): Q.Promise<void> {
        // Attempt to set the value, and if it fails due to the key not existing attempt to create the key
        return this.invokePlistBuddy(`Set ${property} ${value}`, plistFile).fail(() =>
            this.invokePlistBuddy(`Add ${property} string ${value}`, plistFile)
        ).then(() => {});
    }

    public readPlistProperty(plistFile: string, property: string): Q.Promise<string> {
        return this.invokePlistBuddy(`Print ${property}`, plistFile);
    }

    private invokePlistBuddy(command: string, plistFile: string): Q.Promise<string> {
        return new Node.ChildProcess().exec(`${PlistBuddy.plistBuddyExecutable} -c '${command}' '${plistFile}'`).outcome.then((result: Buffer) => {
            return result.toString().trim();
        });
    }
}