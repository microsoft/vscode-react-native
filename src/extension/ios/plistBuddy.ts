// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.

import * as path from "path";
import * as Q from "q";
import * as glob from "glob";
import * as fs from "fs";
import * as semver from "semver";
import * as cp from "child_process";

import {Node} from "../../common/node/node";
import {ChildProcess} from "../../common/node/childProcess";
import { ErrorHelper } from "../../common/error/errorHelper";
import { InternalErrorCode } from "../../common/error/internalErrorCode";
import { ProjectVersionHelper } from "../../common/projectVersionHelper";

export class PlistBuddy {
    private static plistBuddyExecutable = "/usr/libexec/PlistBuddy";

    private nodeChildProcess: ChildProcess;

    constructor({
        nodeChildProcess = new Node.ChildProcess(),
    } = {}) {
        this.nodeChildProcess = nodeChildProcess;
    }

    public getBundleId(iosProjectRoot: string, projectRoot: string, simulator: boolean = true, configuration: string = "Debug", productName?: string, scheme?: string): Q.Promise<string> {
        return ProjectVersionHelper.getReactNativeVersions(projectRoot)
        .then((rnVersions) => {
            let productsFolder;
            if (semver.gte(rnVersions.reactNativeVersion, "0.59.0")) {
                if (!scheme) {
                    // If no scheme were provided via runOptions.scheme or via runArguments then try to get scheme using the way RN CLI does.
                    scheme = this.getInferredScheme(iosProjectRoot, projectRoot, rnVersions.reactNativeVersion);
                }
                productsFolder = path.join(iosProjectRoot, "build", scheme, "Build", "Products");
            } else {
                productsFolder = path.join(iosProjectRoot, "build", "Build", "Products");
            }
            const sdkType = simulator ? "iphonesimulator" : "iphoneos";
            let configurationFolder = path.join(productsFolder, `${configuration}-${sdkType}`);
            let executable = "";
            if (productName) {
                executable = `${productName}.app`;
            } else {
                let executableList = this.findExecutable(configurationFolder);
                if (!executableList.length) {
                    if (!scheme) {
                        throw ErrorHelper.getInternalError(InternalErrorCode.IOSCouldNotFoundExecutableInFolder, configurationFolder);
                    }
                    const projectWorkspaceConfigName = `${scheme}.xcworkspace`;
                    configurationFolder = this.getBuildPath(
                        iosProjectRoot,
                        projectWorkspaceConfigName,
                        configuration,
                        scheme,
                        sdkType
                    );

                    executableList.push(`${scheme}.app`);
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

    public getBuildPath(
        iosProjectRoot: string,
        projectWorkspaceConfigName: string,
        configuration: string,
        scheme: string,
        sdkType: string
    ) {
        const buildSettings = cp.execFileSync(
            "xcodebuild",
            [
                "-workspace",
                projectWorkspaceConfigName,
                "-scheme",
                scheme,
                "-sdk",
                sdkType,
                "-configuration",
                configuration,
                "-showBuildSettings",
            ],
            {
                encoding: "utf8",
                cwd: iosProjectRoot,
            }
        );

        const targetBuildDir = this.getTargetBuildDir(buildSettings);

        if (!targetBuildDir) {
            throw new Error("Failed to get the target build directory.");
        }
        return targetBuildDir;
    }

    public getInferredScheme(iosProjectRoot: string, projectRoot: string, rnVersion: string) {
        // Portion of code was taken from https://github.com/react-native-community/cli/blob/master/packages/platform-ios/src/commands/runIOS/index.js
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
        let iOSCliFolderName: string;
        if (semver.gte(rnVersion, "0.60.0")) {
            iOSCliFolderName = "cli-platform-ios";
        } else {
            iOSCliFolderName = "cli";
        }
        const findXcodeProject = require(path.join(projectRoot, `node_modules/@react-native-community/${iOSCliFolderName}/build/commands/runIOS/findXcodeProject`)).default;
        const xcodeProject = findXcodeProject(fs.readdirSync(iosProjectRoot));
        if (!xcodeProject) {
            throw new Error(
                `Could not find Xcode project files in "${iosProjectRoot}" folder`
            );
        }

        const inferredSchemeName = path.basename(
            xcodeProject.name,
            path.extname(xcodeProject.name)
        );
        return inferredSchemeName;
    }

    private getTargetBuildDir(buildSettings: string) {
        const targetBuildMatch = /TARGET_BUILD_DIR = (.+)$/m.exec(buildSettings);
        return targetBuildMatch && targetBuildMatch[1]
            ? targetBuildMatch[1].trim()
            : null;
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
