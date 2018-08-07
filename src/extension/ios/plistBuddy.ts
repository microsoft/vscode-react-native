// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.

import * as path from "path";
import * as Q from "q";
import * as glob from "glob";

import {Node} from "../../common/node/node";
import {ChildProcess} from "../../common/node/childProcess";

export class PlistBuddy {
    private static plistBuddyExecutable = "/usr/libexec/PlistBuddy";

    private nodeChildProcess: ChildProcess;

    constructor({
        nodeChildProcess = new Node.ChildProcess(),
    } = {}) {
        this.nodeChildProcess = nodeChildProcess;
    }

    public getBundleId(projectRoot: string, simulator: boolean = true, configuration: string = "Debug", productName?: string): Q.Promise<string> {
        const productsFolder = path.join(projectRoot, "build", "Build", "Products");
        const configutationFolder = path.join(productsFolder, `${configuration}${simulator ? "-iphonesimulator" : "-iphoneos"}`);
        let executable = "";
        if (productName) {
            executable = `${productName}.app`;
        } else {
            const executableList = this.findExecutable(configutationFolder);
            if (!executableList.length) {
                throw new Error(`Could not found executable in ${configutationFolder}`);
            } else if (executableList.length > 1) {
                throw new Error(`Found more than one executables in ${configutationFolder}. Please cleanup build folder or setup 'productName' launch option.`);
            }
            executable = `${executableList[0]}`;
        }

        const infoPlistPath = path.join(configutationFolder, executable, "Info.plist");
        return this.invokePlistBuddy("Print:CFBundleIdentifier", infoPlistPath);

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

    private findExecutable(folder: string): string[] {
        return glob.sync("*.app", {
            cwd: folder,
        });
    }

    private invokePlistBuddy(command: string, plistFile: string): Q.Promise<string> {
        return this.nodeChildProcess.exec(`${PlistBuddy.plistBuddyExecutable} -c '${command}' '${plistFile}'`).outcome.then((result: string) => {
            return result.toString().trim();
        });
    }
}
