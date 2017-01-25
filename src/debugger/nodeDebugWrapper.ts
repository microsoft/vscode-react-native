// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.

import * as Q from "q";
import * as path from "path";
import * as fs from "fs";
import stripJsonComments = require("strip-json-comments");

import {TelemetryHelper} from "../common/telemetryHelper";
import {RemoteExtension} from "../common/remoteExtension";
import {IOSPlatform} from "./ios/iOSPlatform";
import {PlatformResolver} from "./platformResolver";
import {IRunOptions} from "../common/launchArgs";
import {TargetPlatformHelper} from "../common/targetPlatformHelper";
import {NodeDebugAdapterLogger} from "../common/log/loggers";
import {Log} from "../common/log/log";
import {GeneralMobilePlatform} from "../common/generalMobilePlatform";

import { ForkedAppWorker } from "./forkedAppWorker";
import { MultipleLifetimesAppWorker } from "./appWorker";

interface ReactNativeLaunchRequestArguments extends ILaunchRequestArgs {
    args: string[];
    platform: string;
    program: string;
    internalDebuggerPort?: any;
    target?: string;
    iosRelativeProjectPath?: string;
    logCatArguments: any;
}

interface ReactNativeAttachRequestArguments extends IAttachRequestArgs {
    args: string[];
    platform: string;
    program: string;
    internalDebuggerPort?: any;
}

export function createAdapter (
        baseDebugAdapterClass: typeof ChromeDebuggerCorePackage.ChromeDebugAdapter,
        vscodeDebugPackage: typeof VSCodeDebugAdapterPackage) {

    return class ReactNativeDebugAdapter extends baseDebugAdapterClass {
        private projectRootPath: string;
        private remoteExtension: RemoteExtension;
        private mobilePlatformOptions: IRunOptions;

        private appWorker: MultipleLifetimesAppWorker;

        public launch(args: ReactNativeLaunchRequestArguments): Promise<void> {
            this.requestSetup(args);

            this.mobilePlatformOptions.target = args.target || "simulator";
            this.mobilePlatformOptions.iosRelativeProjectPath = !isNullOrUndefined(args.iosRelativeProjectPath) ?
                args.iosRelativeProjectPath :
                IOSPlatform.DEFAULT_IOS_PROJECT_RELATIVE_PATH;

            // We add the parameter if it's defined (adapter crashes otherwise)
            if (!isNullOrUndefined(args.logCatArguments)) {
                this.mobilePlatformOptions.logCatArguments = [parseLogCatArguments(args.logCatArguments)];
            }

            return Promise.resolve().then(() => {
                return TelemetryHelper.generate("launch", (generator) => {
                    const resolver = new PlatformResolver();
                    return this.remoteExtension.getPackagerPort()
                    .then(packagerPort => {
                        this.mobilePlatformOptions.packagerPort = packagerPort;
                        const mobilePlatform = resolver.resolveMobilePlatform(args.platform, this.mobilePlatformOptions);
                        return Q({})
                            .then(() => {
                                generator.step("checkPlatformCompatibility");
                                TargetPlatformHelper.checkTargetPlatformSupport(this.mobilePlatformOptions.platform);
                                generator.step("startPackager");
                                return mobilePlatform.startPackager();
                            })
                            .then(() => {
                                // We've seen that if we don't prewarm the bundle cache, the app fails on the first attempt to connect to the debugger logic
                                // and the user needs to Reload JS manually. We prewarm it to prevent that issue
                                generator.step("prewarmBundleCache");
                                Log.logMessage("Prewarming bundle cache. This may take a while ...");
                                return mobilePlatform.prewarmBundleCache();
                            })
                            .then(() => {
                                generator.step("mobilePlatform.runApp");
                                Log.logMessage("Building and running application.");
                                return mobilePlatform.runApp();
                            })
                            .then(() => {
                                generator.step("mobilePlatform.enableJSDebuggingMode");
                                return mobilePlatform.enableJSDebuggingMode();
                            })
                            .then(() => {
                            	Log.logMessage("Starting debugger app worker.");

                                const workspaceRootPath = path.resolve(path.dirname(args.program), "..");
                                const sourcesStoragePath = path.join(workspaceRootPath, ".vscode", ".react");

	                            this.appWorker = new MultipleLifetimesAppWorker(
	                                packagerPort, sourcesStoragePath, 9090, {
	                                    sandboxedAppConstructor: (path: string, port: number, messageFunc: (message: any) => void) =>
	                                        new ForkedAppWorker(packagerPort, path, port, messageFunc),
	                                }
	                            );
	
	                            this.appWorker.start();
	                            return this.appWorker.waitForDebuggee();
                            })
                            .then(() => {
                            	return super.attach(Object.assign(args, { port: debuggee.port }));
                            });
                    }).catch(error => this.bailOut(error.message));
                });
            });
        }

        public attach(args: ReactNativeAttachRequestArguments): Promise<void> {
            this.requestSetup(args);
            const mobilePlatform = new GeneralMobilePlatform(this.mobilePlatformOptions);

            return Promise.resolve().then(() => {
                return TelemetryHelper.generate("attach", (generator) => {
                    generator.step("mobilePlatform.enableJSDebuggingMode");
                    return mobilePlatform.enableJSDebuggingMode()
                    // FIXME: Need to think a bit more whether we need to call super.doAttach here or just super.attach
                    .then(() => super.attach(args))
                    .catch(error => this.bailOut(error.message));
                });
            });
        }

        // TODO: maybe better listen to terminateSession
        public disconnect(): void {
            if (this.mobilePlatformOptions.platform !== "android") {
                return super.disconnect();
            }

            // First we tell the extension to stop monitoring the logcat, and then we disconnect the debugging session
            this.remoteExtension.stopMonitoringLogcat()
            .catch(reason => Log.logError(`WARNING: Couldn't stop monitoring logcat: ${reason.message || reason}\n`))
            .finally(() => super.disconnect());
        }

        /**
         * Makes the required setup for request customization
         * - Enables telemetry
         * - Sets up mobilePlatformOptions, remote extension and projectRootPath
         * - Starts debug server
         * - Create global logger
         */
        private requestSetup(args: any) {
            this.projectRootPath = getProjectRoot(args);
            this.remoteExtension = RemoteExtension.atProjectRootPath(this.projectRootPath);
            this.mobilePlatformOptions = {
                projectRoot: this.projectRootPath,
                platform: args.platform,
            };

            // Send an "initialized" event to trigger breakpoints to be re-sent
            // TODO: send only when really initialized
            // this._session.sendEvent(new InitializedEvent());

            Log.SetGlobalLogger(new NodeDebugAdapterLogger(vscodeDebugPackage, this._session));
        }

        /**
         * Logs error to user and finishes the debugging process.
         */
        private bailOut(message: string): void {
            Log.logError(`Could not debug. ${message}`);
            // use public terminateSession from Node2DebugAdapter
            this.terminateSession(message);
            // this._session.sendEvent(new TerminatedEvent());
            process.exit(1);
        };
    };
}

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
