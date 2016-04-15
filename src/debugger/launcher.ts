// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.

import * as fs from "fs";
import * as path from "path";
import * as Q from "q";
import {MultipleLifetimesAppWorker} from "./appWorker";
import {Log} from "../common/log/log";
import {ErrorHelper} from "../common/error/errorHelper";
import {InternalErrorCode} from "../common/error/internalErrorCode";
import {ScriptImporter} from "./scriptImporter";
import {PlatformResolver} from "./platformResolver";
import {TelemetryHelper} from "../common/telemetryHelper";
import {TargetPlatformHelper} from "../common/targetPlatformHelper";
import {IRunOptions} from "../common/launchArgs";
import {RemoteExtension} from "../common/remoteExtension";
import {EntryPointHandler, ProcessType} from "../common/entryPointHandler";

export class Launcher {
    private projectRootPath: string;
    private remoteExtension: RemoteExtension;

    constructor(projectRootPath: string) {
        this.projectRootPath = projectRootPath;
        this.remoteExtension = new RemoteExtension(this.projectRootPath);
    }

    public launch(): void {
        // Enable telemetry
        new EntryPointHandler(ProcessType.Debugee).runApp("react-native-debug-process", () => this.getAppVersion(),
            ErrorHelper.getInternalError(InternalErrorCode.DebuggingFailed), this.projectRootPath, () => {
                return TelemetryHelper.generate("launch", (generator) => {
                    const resolver = new PlatformResolver();
                    return this.parseRunOptions().then(runOptions => {
                        const mobilePlatform = resolver.resolveMobilePlatform(runOptions.platform, runOptions);
                        if (!mobilePlatform) {
                            throw new RangeError("The target platform could not be read. Did you forget to add it to the launch.json configuration arguments?");
                        } else {
                            const sourcesStoragePath = path.join(this.projectRootPath, ".vscode", ".react");
                            return Q({})
                                .then(() => {
                                    generator.step("checkPlatformCompatibility");
                                    TargetPlatformHelper.checkTargetPlatformSupport(runOptions.platform);
                                    generator.step("startPackager");
                                    return this.remoteExtension.startPackager();
                                })
                                .then(() => {
                                    let scriptImporter = new ScriptImporter(runOptions.packagerPort, sourcesStoragePath);
                                    return scriptImporter.downloadDebuggerWorker(sourcesStoragePath).then(() => {
                                        Log.logMessage("Downloaded debuggerWorker.js (Logic to run the React Native app) from the Packager.");
                                    });
                                })
                                // We've seen that if we don't prewarm the bundle cache, the app fails on the first attempt to connect to the debugger logic
                                // and the user needs to Reload JS manually. We prewarm it to prevent that issue
                                .then(() => {
                                    generator.step("prewarmBundleCache");
                                    Log.logMessage("Prewarming bundle cache. This may take a while ...");
                                    return this.remoteExtension.prewarmBundleCache(runOptions.platform);
                                })
                                .then(() => {
                                    generator.step("mobilePlatform.runApp");
                                    Log.logMessage("Building and running application.");
                                    return mobilePlatform.runApp();
                                })
                                .then(() => {
                                    generator.step("Starting App Worker");
                                    Log.logMessage("Starting debugger app worker.");
                                    return new MultipleLifetimesAppWorker(runOptions.packagerPort, sourcesStoragePath, runOptions.debugAdapterPort).start();
                                }) // Start the app worker
                                .then(() => {
                                    generator.step("mobilePlatform.enableJSDebuggingMode");
                                    return mobilePlatform.enableJSDebuggingMode();
                                }).then(() =>
                                    Log.logMessage("Debugging session started successfully."));
                        }
                    });
                });
            });
    }

    private getAppVersion() {
        return JSON.parse(fs.readFileSync(path.join(__dirname, "..", "..", "package.json"), "utf-8")).version;
    }

    /**
     * Parses the launch arguments set in the launch configuration.
     */
    private parseRunOptions(): Q.Promise<IRunOptions> {
        // We expect our debugAdapter to pass in arguments as [platform, debugAdapterPort, target?, logCatArguments?];
        return this.remoteExtension.getPackagerPort().then(packagerPort => {
            return {
                projectRoot: this.projectRootPath,
                platform: process.argv[2].toLowerCase(),
                debugAdapterPort: parseInt(process.argv[3], 10) || 9090,
                target: process.argv[4],
                packagerPort: packagerPort,
                logCatArguments: process.argv[5],
            };
        });
    }
}
