// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.

import * as path from "path";
import * as Q from "q";

import {Node} from "../../common/node/node";
import {ChildProcess} from "../../common/node/childProcess";
import {Xcodeproj, IXcodeProjFile} from "./xcodeproj";

export class PlistBuddy {
    private static plistBuddyExecutable = "/usr/libexec/PlistBuddy";

    private nodeChildProcess: ChildProcess;
    private xcodeproj: Xcodeproj;

    constructor({
        nodeChildProcess = new Node.ChildProcess(),
        xcodeproj = new Xcodeproj(),
    } = {}) {
        this.nodeChildProcess = nodeChildProcess;
        this.xcodeproj = xcodeproj;
    }

    public getBundleId(projectRoot: string, simulator: boolean = true): Q.Promise<string> {
        return this.xcodeproj.findXcodeprojFile(projectRoot).then((projectFile: IXcodeProjFile) => {
            const infoPlistPath = path.join(projectRoot, "build", "Build", "Products",
                simulator ? "Debug-iphonesimulator" : "Debug-iphoneos",
                `${projectFile.projectName}.app`, "Info.plist");

            return this.invokePlistBuddy("Print:CFBundleIdentifier", infoPlistPath);
        });
    }

    public setPlistProperty(plistFile: string, property: string, value: string): Q.Promise<void> {
        // Attempt to set the value, and if it fails due to the key not existing attempt to create the key
        return this.invokePlistBuddy(`Set ${property} ${value}`, plistFile).fail(() =>
            this.invokePlistBuddy(`Add ${property} string ${value}`, plistFile)
        ).then(() => { });
    }

    public setPlistBooleanProperty(plistFile: string, property: string, value: boolean): Q.Promise<void> {
        // Attempt to set the value, and if it fails due to the key not existing attempt to create the key
        return this.invokePlistBuddy(`Set ${property} ${value}`, plistFile)
            .fail(() =>
                this.invokePlistBuddy(`Add ${property} bool ${value}`, plistFile)
            )
            .then(() => { });
    }

    public deletePlistProperty(plistFile: string, property: string): Q.Promise<void> {
        return this.invokePlistBuddy(`Delete ${property}`, plistFile).then(() => { });
    }

    public readPlistProperty(plistFile: string, property: string): Q.Promise<string> {
        return this.invokePlistBuddy(`Print ${property}`, plistFile);
    }

    private invokePlistBuddy(command: string, plistFile: string): Q.Promise<string> {
        return this.nodeChildProcess.exec(`${PlistBuddy.plistBuddyExecutable} -c '${command}' '${plistFile}'`).outcome.then((result: string) => {
            return result.toString().trim();
        });
    }
}
