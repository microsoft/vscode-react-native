// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.

import * as fs from "fs";
import * as path from "path";

import {TelemetryHelper} from "../common/telemetryHelper";
import {EntryPointHandler, ProcessType} from "../common/entryPointHandler";
import {ErrorHelper} from "../common/error/errorHelper";
import {InternalErrorCode} from "../common/error/internalErrorCode";
import {NullTelemetryReporter, ReassignableTelemetryReporter} from "../common/telemetryReporters";

import { createAdapter } from "./nodeDebugWrapper";
import { MultipleLifetimesAppWorker } from "./appWorker";


import {RemoteExtension} from "../common/remoteExtension";
import {IOSPlatform} from "./ios/iOSPlatform";
import {PlatformResolver} from "./platformResolver";
import {IRunOptions} from "../common/launchArgs";
import {TargetPlatformHelper} from "../common/targetPlatformHelper";
import {NodeDebugAdapterLogger} from "../common/log/loggers";
import {Log} from "../common/log/log";
import {GeneralMobilePlatform} from "../common/generalMobilePlatform";

import { ForkedAppWorker } from "./forkedAppWorker";



const version = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "..", "package.json"), "utf-8")).version;
const telemetryReporter = new ReassignableTelemetryReporter(new NullTelemetryReporter());
const extensionName = "react-native-debug-adapter";

function bailOut(reason: string): void {
    // Things have gone wrong in initialization: Report the error to telemetry and exit
    TelemetryHelper.sendSimpleEvent(reason);
    process.exit(1);
}

// Enable telemetry
new EntryPointHandler(ProcessType.Debugger).runApp(extensionName, () => version,
    ErrorHelper.getInternalError(InternalErrorCode.DebuggingFailed), telemetryReporter, () => {

        /**
         * For debugging React Native we basically want to debug node plus some other stuff.
         * There is no need to create a new adapter for node because ther already exists one.
         * We look for node debug adapter on client's computer so we can jump of on top of that.
         */
        let nodeDebugFolder: string;
        let VSCodeDebugAdapter: typeof VSCodeDebugAdapterPackage;
        let Node2DebugAdapter: typeof Node2DebugAdapterPackage.Node2DebugAdapter;
        let ChromeDebugSession: typeof ChromeDebuggerCorePackage.ChromeDebugSession;

        // nodeDebugLocation.json is dynamically generated on extension activation.
        // If it fails, we must not have been in a react native project
        try {
            /* tslint:disable:no-var-requires */
            // nodeDebugFolder = require("./nodeDebugLocation.json").nodeDebugPath;
            nodeDebugFolder = "/Applications/Visual Studio Code.app/Contents/Resources/app/extensions/ms-vscode.node-debug2";
            VSCodeDebugAdapter = require(path.join(nodeDebugFolder, "node_modules/vscode-debugadapter"));
            ChromeDebugSession = require(path.join(nodeDebugFolder, "node_modules/vscode-chrome-debug-core")).ChromeDebugSession;
            Node2DebugAdapter = require(path.join(nodeDebugFolder, "out/src/nodeDebugAdapter")).NodeDebugAdapter;
            /* tslint:enable:no-var-requires */
        } catch (e) {
            // Nothing we can do here: can't even communicate back because we don't know how to speak debug adapter
            bailOut("cannotFindDebugAdapter");
        }

        /**
         * We did find node debug adapter. Lets get the debugSession from it.
         * And add our customizations to the requests.
         */

        let adapter: any;
        // Customize node adapter requests
        try {
            // Create customised react-native debug adapter based on Node-debug2 adapter
            adapter = createAdapter(Node2DebugAdapter, VSCodeDebugAdapter);
        } catch (e) {
            const debugSession = new ChromeDebugSession();
            debugSession.sendEvent(new VSCodeDebugAdapter.OutputEvent("Unable to start debug adapter: " + e.toString(), "stderr"));
            debugSession.sendEvent(new VSCodeDebugAdapter.TerminatedEvent());
            bailOut(e.toString());
        }

        const debugSessionOpts = {
            logFilePath: path.join(`/Users/kotikov.vladimir/${extensionName}.log`),
            adapter,
            extensionName,
        };

        // Create a debug session class based on ChromeDebugSession
        const ReactNativeDebugSession = class extends ChromeDebugSession {
            protected appName: string = extensionName;
            protected version: string = version;

            private appWorker: MultipleLifetimesAppWorker = null;

            constructor(debuggerLinesAndColumnsStartAt1?: boolean, isServer?: boolean) {
                super(debuggerLinesAndColumnsStartAt1, isServer, debugSessionOpts);
            }

            public sendEvent(event: VSCodeDebugAdapterPackage.Event): void {
                if (event.event === "terminated" && event.body.restart === true) {
                    this._debugAdapter = new adapter(debugSessionOpts, this);
                    return;
                }

                super.sendEvent(event);
            }

            protected dispatchRequest(request: { command: string, arguments: any }) {

                if (request.command === "disconnect") {
                    // stop debuggee worker and disconnect from the packager
                    this.appWorker.stop();

                    if (this.mobilePlatformOptions.platform === "android") {
                        // First we tell the extension to stop monitoring the logcat, and then we disconnect the debugging session
                        this.remoteExtension.stopMonitoringLogcat()
                        .catch(reason => Log.logError(`WARNING: Couldn't stop monitoring logcat: ${reason.message || reason}\n`));
                    }

                    return super.dispatchRequest(request);
                }

                if (request.command !== "launch") {
                    return super.dispatchRequest(request);
                }

                this.requestSetup(request.arguments);

                this.mobilePlatformOptions.target = request.arguments.target || "simulator";
                this.mobilePlatformOptions.iosRelativeProjectPath = !isNullOrUndefined(request.arguments.iosRelativeProjectPath) ?
                    request.arguments.iosRelativeProjectPath :
                    IOSPlatform.DEFAULT_IOS_PROJECT_RELATIVE_PATH;

                // We add the parameter if it's defined (adapter crashes otherwise)
                if (!isNullOrUndefined(request.arguments.logCatArguments)) {
                    this.mobilePlatformOptions.logCatArguments = [parseLogCatArguments(request.arguments.logCatArguments)];
                }

                this.remoteExtension.getPackagerPort()
                .then((packagerPort: number) => {
                    this.packagerPort = packagerPort;
                    return request.command === "attach" ?
                        Promise.resolve(new GeneralMobilePlatform(this.mobilePlatformOptions)) :
                        Promise.resolve().then(() => {
                            this.mobilePlatformOptions.packagerPort = packagerPort;
                            const resolver = new PlatformResolver();
                            const mobilePlatform = resolver.resolveMobilePlatform(request.arguments.platform, this.mobilePlatformOptions);

                            TargetPlatformHelper.checkTargetPlatformSupport(this.mobilePlatformOptions.platform);
                            return mobilePlatform.startPackager()
                            .then(() => {
                                // We've seen that if we don't prewarm the bundle cache, the app fails on the first attempt to connect to the debugger logic
                                // and the user needs to Reload JS manually. We prewarm it to prevent that issue
                                Log.logMessage("Prewarming bundle cache. This may take a while ...");
                                return mobilePlatform.prewarmBundleCache();
                            })
                            .then(() => {
                                Log.logMessage("Building and running application.");
                                return mobilePlatform.runApp();
                            })
                            .then(() => {
                                return mobilePlatform;
                            });
                        });
                })
                .then((mobilePlatform) => {
                    return mobilePlatform.enableJSDebuggingMode();
                })
                .then(() => {
                    Log.logMessage("Starting debugger app worker.");
                    // TODO: remove dependency on args.program - "program" property is technically
                    // no more required in launch configuration and could be removed
                    const workspaceRootPath = path.resolve(path.dirname(request.arguments.program), "..");
                    const sourcesStoragePath = path.join(workspaceRootPath, ".vscode", ".react");

                    // If launch is invoked first time, appWorker is undefined, so create it here
                    this.appWorker = new MultipleLifetimesAppWorker( this.packagerPort, sourcesStoragePath, 9090, {
                            // Inject our custom debuggee worker
                            sandboxedAppConstructor: (path: string, port: number, messageFunc: (message: any) => void) =>
                                new ForkedAppWorker(this.packagerPort, path, port, messageFunc),
                        }
                    );

                    this.appWorker.on("connected", (debuggeePort: number) => {
                        let reqArgs = Object.assign({}, request.arguments, {
                            port: debuggeePort,
                            restart: true,
                            request: "attach"
                        });

                        let req = Object.assign({}, request, {
                            command: "attach",
                            arguments: reqArgs
                        });

                        super.dispatchRequest(req);
                    });
                })
                .then(() => {
                    this.appWorker.start();
                })
                .catch((error: any) => this.bailOut(error.message));
            }

            /**
             * Logs error to user and finishes the debugging process.
             */
            private bailOut(message: string): void {
                Log.logError(`Could not debug. ${message}`);
                // use public terminateSession from Node2DebugAdapter
                // this.terminateSession(message);
                // this._session.sendEvent(new TerminatedEvent());
                // process.exit(1);
            };

            private packagerPort: number;
            private projectRootPath: string;
            private remoteExtension: RemoteExtension;
            private mobilePlatformOptions: IRunOptions;

            private requestSetup(args: any) {
                this.projectRootPath = getProjectRoot(args);
                this.remoteExtension = RemoteExtension.atProjectRootPath(this.projectRootPath);
                this.mobilePlatformOptions = {
                    projectRoot: this.projectRootPath,
                    platform: args.platform,
                };

                Log.SetGlobalLogger(new NodeDebugAdapterLogger(VSCodeDebugAdapter, this));
            }
        };

        // Run the debug session for the node debug adapter with our modified requests
        ChromeDebugSession.run(ReactNativeDebugSession);
    });

import stripJsonComments = require("strip-json-comments");

/**
 * Parses settings.json file for workspace root property
 */
function getProjectRoot(args: any): string {
    try {
        let vsCodeRoot = path.resolve(args.program, "../..");
        let settingsPath = path.resolve(vsCodeRoot, ".vscode/settings.json");
        let settingsContent = fs.readFileSync(settingsPath, "utf8");
        settingsContent = stripJsonComments(settingsContent);
        let parsedSettings = JSON.parse(settingsContent);
        let projectRootPath = parsedSettings["react-native-tools"].projectRoot;
        return path.resolve(vsCodeRoot, projectRootPath);
    } catch (e) {
        return path.resolve(args.program, "../..");
    }
}

/**
 * Helper method to know if a value is either null or undefined
 */
function isNullOrUndefined(value: any): boolean {
    return typeof value === "undefined" || value === null;
}

/**
 * Parses log cat arguments to a string
 */
function parseLogCatArguments(userProvidedLogCatArguments: any): string {
    return Array.isArray(userProvidedLogCatArguments)
        ? userProvidedLogCatArguments.join(" ") // If it's an array, we join the arguments
        : userProvidedLogCatArguments; // If not, we leave it as-is
}
