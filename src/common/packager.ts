// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.

import {ChildProcess} from "child_process";
import {CommandExecutor} from "./commandExecutor";
import {Log, LogLevel} from "./log";
import {Node} from "./node/node";
import {OutputChannel} from "vscode";
import {Package} from "./node/package";
import {PromiseUtil} from "./node/promise";
import {Request} from "./node/request";

import * as Q from "q";
import * as path from "path";

export class Packager {
    // TODO: Make the port configurable via a launch argument
    public static PORT = "8081";
    public static HOST = `localhost:${Packager.PORT}`;
    public static DEBUGGER_WORKER_FILE_BASENAME = "debuggerWorker";
    public static DEBUGGER_WORKER_FILENAME = Packager.DEBUGGER_WORKER_FILE_BASENAME + ".js";

    private projectPath: string;
    private packagerProcess: ChildProcess;
    private sourcesStoragePath: string;

    private static JS_INJECTOR_FILENAME = "opn-main.js";
    private static JS_INJECTOR_FILEPATH = path.resolve(path.dirname(path.dirname(__dirname)), "js-patched", Packager.JS_INJECTOR_FILENAME);
    private static NODE_MODULES_FODLER_NAME = "node_modules";
    private static OPN_PACKAGE_NAME = "opn";
    private static REACT_NATIVE_PACKAGE_NAME = "react-native";
    private static OPN_PACKAGE_MAIN_FILENAME = "index.js";

    constructor(projectPath: string, sourcesStoragePath?: string) {
        this.projectPath = projectPath;
        this.sourcesStoragePath = sourcesStoragePath;
    }

    public start(outputChannel?: OutputChannel): Q.Promise<void> {
        this.isRunning().done(running => {
            if (!running) {
                return this.monkeyPatchOpnForRNPackager()
                .then(() => {
                    let args = ["--port", Packager.PORT];
                    let childEnvForDebugging = Object.assign({}, process.env, { REACT_DEBUGGER: "echo A debugger is not needed: " });

                    Log.logMessage("Starting Packager", outputChannel);
                    // The packager will continue running while we debug the application, so we can"t
                    // wait for this command to finish

                    let spawnOptions = { env: childEnvForDebugging };

                    new CommandExecutor(this.projectPath).spawnReactCommand("start", args, spawnOptions, outputChannel).then((packagerProcess) => {
                        this.packagerProcess = packagerProcess;
                    });
                }).done();
            }
        });

        return this.awaitStart().then(() => {
            Log.logMessage("Packager started.", outputChannel);
            if (this.sourcesStoragePath) {
                return this.downloadDebuggerWorker().then(() => {
                    Log.logMessage("Downloaded debuggerWorker.js (Logic to run the React Native app) from the Packager.");
                });
            }
        });
    }

    public stop(outputChannel?: OutputChannel): void {
        Log.logMessage("Stopping Packager", outputChannel);

        if (this.packagerProcess) {
            this.packagerProcess.kill();
            this.packagerProcess = null;
            Log.logMessage("Packager stopped", outputChannel);
        } else {
            Log.logMessage("Packager not found", outputChannel);
        }
    }

    public prewarmBundleCache(platform: string) {
        let bundleURL = `http://${Packager.HOST}/index.${platform}.bundle`;
        Log.logInternalMessage(LogLevel.Info, "About to get: " + bundleURL);
        return new Request().request(bundleURL, true).then(() => {
            Log.logMessage("The Bundle Cache was prewarmed.");
        }).catch(() => {
            // The attempt to prefetch the bundle failed.
            // This may be because the bundle is not index.* so we shouldn't treat this as fatal.
        });
    }

    private isRunning(): Q.Promise<boolean> {
        let statusURL = `http://${Packager.HOST}/status`;

        return new Request().request(statusURL)
            .then((body: string) => {
                return body === "packager-status:running";
            },
            (error: any) => {
                return false;
            });
    }

    private awaitStart(retryCount = 30, delay = 2000): Q.Promise<boolean> {
        let pu: PromiseUtil = new PromiseUtil();
        return pu.retryAsync(() => this.isRunning(), (running) => running, retryCount, delay, "Could not start the packager.");
    }

    private downloadDebuggerWorker(): Q.Promise<void> {
        let debuggerWorkerURL = `http://${Packager.HOST}/${Packager.DEBUGGER_WORKER_FILENAME}`;
        let debuggerWorkerLocalPath = path.join(this.sourcesStoragePath, Packager.DEBUGGER_WORKER_FILENAME);
        Log.logInternalMessage(LogLevel.Info, "About to download: " + debuggerWorkerURL + " to: " + debuggerWorkerLocalPath);
        return new Request().request(debuggerWorkerURL, true).then((body: string) => {
            return new Node.FileSystem().writeFile(debuggerWorkerLocalPath, body);
        });
    }

    private findOpnPackage(): Q.Promise<string> {
        try {
            let flatDependencyPackagePath = path.resolve(this.projectPath, Packager.NODE_MODULES_FODLER_NAME,
                Packager.OPN_PACKAGE_NAME, Packager.OPN_PACKAGE_MAIN_FILENAME);

            let nestedDependencyPackagePath = path.resolve(this.projectPath, Packager.NODE_MODULES_FODLER_NAME,
                Packager.REACT_NATIVE_PACKAGE_NAME, Packager.NODE_MODULES_FODLER_NAME, Packager.OPN_PACKAGE_NAME, Packager.OPN_PACKAGE_MAIN_FILENAME);

            let fsHelper = new Node.FileSystem();

            // Attempt to find the 'opn' package directly under the project's node_modules folder (node4 +)
            // Else, attempt to find the package within the dependent node_modules of react-native package
            let possiblePaths = [flatDependencyPackagePath, nestedDependencyPackagePath];
            return Q.any(possiblePaths.map(path =>
                fsHelper.exists(path).then(exists =>
                    exists
                        ? Q.resolve(path)
                        : Q.reject<string>("opn package location not found"))));
        } catch (err) {
            console.error ("The package \'opn\' was not found." + err);
        }
    }

    private monkeyPatchOpnForRNPackager(): Q.Promise<void> {
        let opnPackage: Package;
        let destnFilePath: string;

        // Finds the 'opn' package
        return this.findOpnPackage()
        .then((opnIndexFilePath) => {
            destnFilePath = opnIndexFilePath;
            // Read the package's "package.json"
            opnPackage = new Package(path.resolve(path.dirname(destnFilePath)));
            return opnPackage.parsePackageInformation();
        }).then((packageJson) => {
            if (packageJson.main !== Packager.JS_INJECTOR_FILENAME) {
                // Copy over the patched 'opn' main file
                return new Node.FileSystem().copyFile(Packager.JS_INJECTOR_FILEPATH, path.resolve(path.dirname(destnFilePath), Packager.JS_INJECTOR_FILENAME))
                .then(() => {
                    // Write/over-write the "main" attribute with the new file
                    return opnPackage.setMainFile(Packager.JS_INJECTOR_FILENAME);
                });
            }
        });
    }
}
