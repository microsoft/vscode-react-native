// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.

import * as path from "path";
import * as Q from "q";
import * as glob from "glob";
import * as fs from "fs";

import {Node} from "../../common/node/node";
import {ChildProcess} from "../../common/node/childProcess";
import { ErrorHelper } from "../../common/error/errorHelper";
import { InternalErrorCode } from "../../common/error/internalErrorCode";
import { ReactNativeProjectHelper } from "../../common/reactNativeProjectHelper";
import semver = require("semver");

export class PlistBuddy {
    private static plistBuddyExecutable = "/usr/libexec/PlistBuddy";

    private nodeChildProcess: ChildProcess;

    constructor({
        nodeChildProcess = new Node.ChildProcess(),
    } = {}) {
        this.nodeChildProcess = nodeChildProcess;
    }

    public getBundleId(iosProjectRoot: string, simulator: boolean = true, configuration: string = "Debug", productName?: string, scheme?: string): Q.Promise<string> {
        const projectRoot = path.normalize(path.join(iosProjectRoot, ".."));
        return ReactNativeProjectHelper.getReactNativeVersion(projectRoot)
        .then((rnVersion) => {
            let productsFolder;
            if (semver.gte(rnVersion, "0.59.0")) {
                if (!scheme) {
                    // If no scheme were provided via runOptions.scheme`~ then try to get scheme using the way RN CLI does.
                    scheme = this.getInferredScheme(projectRoot);
                }
                productsFolder = path.join(iosProjectRoot, "build", scheme, "Build", "Products");
            } else {
                productsFolder = path.join(iosProjectRoot, "build", "Build", "Products");
            }
            const configurationFolder = path.join(productsFolder, `${configuration}${simulator ? "-iphonesimulator" : "-iphoneos"}`);
            let executable = "";
            if (productName) {
                executable = `${productName}.app`;
            } else {
                const executableList = this.findExecutable(configurationFolder);
                if (!executableList.length) {
                    throw ErrorHelper.getInternalError(InternalErrorCode.IOSCouldNotFoundExecutableInFolder, configurationFolder);
                } else if (executableList.length > 1) {
                    throw ErrorHelper.getInternalError(InternalErrorCode.IOSFoundMoreThanOneExecutablesCleanupBuildFolder, configurationFolder);
                }
                executable = `${executableList[0]}`;
            }

            const infoPlistPath = path.join(configurationFolder, executable, "Info.plist");
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

    public getInferredScheme(projectRoot: string) {
        // Portion of code was taken from https://github.com/react-native-community/react-native-cli/blob/master/packages/cli/src/commands/runIOS/runIOS.js
        // and modified a little bit
        /**
         * Copyright (c) Facebook, Inc. and its affiliates.
         *
         * This source code is licensed under the MIT license found in the
         * LICENSE file in the root directory of this source tree.
         *
         * @flow
         * @format
         */
        const findXcodeProject = require(path.join(projectRoot, "node_modules/@react-native-community/cli/build/commands/runIOS/findXcodeProject")).default;
        const xcodeProject = findXcodeProject(fs.readdirSync(`${projectRoot}/ios`));
        if (!xcodeProject) {
            throw new Error(
                `Could not find Xcode project files in "${`${projectRoot}/ios`}" folder`
            );
        }

        const inferredSchemeName = path.basename(
            xcodeProject.name,
            path.extname(xcodeProject.name)
        );
        return inferredSchemeName;
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
