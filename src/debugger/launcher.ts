// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.

import * as fs from "fs";
import * as path from "path";

import {MultipleLifetimesAppWorker} from "./appWorker";
import {ErrorHelper} from "../common/error/errorHelper";
import {InternalErrorCode} from "../common/error/internalErrorCode";
import {ScriptImporter} from "./scriptImporter";
import {TelemetryHelper} from "../common/telemetryHelper";
import {Log} from "../common/log/log";
import {RemoteExtension} from "../common/remoteExtension";
import {EntryPointHandler, ProcessType} from "../common/entryPointHandler";

export class Launcher {
    private projectRootPath: string;
    private remoteExtension: RemoteExtension;

    constructor(projectRootPath: string) {
        this.projectRootPath = projectRootPath;
        this.remoteExtension = RemoteExtension.atProjectRootPath(this.projectRootPath);
    }

    public launch(): void {
        const debugAdapterPort = parseInt(process.argv[2], 10) || 9090;
        // Enable telemetry
        new EntryPointHandler(ProcessType.Debugee).runApp("react-native-debug-process", () => this.getAppVersion(),
            ErrorHelper.getInternalError(InternalErrorCode.DebuggingFailed), this.projectRootPath, () => {
                return TelemetryHelper.generate("launch", (generator) => {
                    const sourcesStoragePath = path.join(this.projectRootPath, ".vscode", ".react");
                    return this.remoteExtension.getPackagerPort().then(packagerPort => {
                        let scriptImporter = new ScriptImporter(packagerPort, sourcesStoragePath);
                        return scriptImporter.downloadDebuggerWorker(sourcesStoragePath).then(() => {
                            Log.logMessage("Downloaded debuggerWorker.js (Logic to run the React Native app) from the Packager.");
                        }).then(() => {
                            generator.step("Starting App Worker");
                            Log.logMessage("Starting debugger app worker.");
                            return new MultipleLifetimesAppWorker(packagerPort, sourcesStoragePath, debugAdapterPort).start();
                        }).then(() =>
                            Log.logMessage("Debugging session started successfully."));
                    });
                });
            }
        );
    }

    private getAppVersion() {
        return JSON.parse(fs.readFileSync(path.join(__dirname, "..", "..", "package.json"), "utf-8")).version;
    }
}
