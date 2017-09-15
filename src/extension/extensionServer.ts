// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.

import * as net from "net";
import * as Q from "q";
import * as vscode from "vscode";

import * as em from "../common/extensionMessaging";
import {OutputChannelLogger} from "./log/OutputChannelLogger";
import {Packager} from "../common/packager";
import {PackagerStatusIndicator} from "./packagerStatusIndicator";
import {LogCatMonitor} from "./android/logCatMonitor";
import {FileSystem} from "../common/node/fileSystem";
import {SettingsHelper} from "./settingsHelper";
import {Telemetry} from "../common/telemetry";
import * as path from "path";
import * as fs from "fs";
import stripJsonComments = require("strip-json-comments");
import {PlatformResolver} from "./platformResolver";
import {TelemetryHelper} from "../common/telemetryHelper";
import {TargetPlatformHelper} from "../common/targetPlatformHelper";
import {MobilePlatformDeps} from "./generalMobilePlatform";

export class ExtensionServer implements vscode.Disposable {
    private serverInstance: net.Server | null = null;
    private messageHandlerDictionary: { [id: number]: ((...argArray: any[]) => Q.Promise<any>) } = {};
    private reactNativePackager: Packager;
    private reactNativePackageStatusIndicator: PackagerStatusIndicator;
    private pipePath: string;
    private logCatMonitor: LogCatMonitor | null = null;
    private logger: OutputChannelLogger = OutputChannelLogger.getMainChannel();

    public constructor(projectRootPath: string, reactNativePackager: Packager, packagerStatusIndicator: PackagerStatusIndicator) {

        this.pipePath = new em.MessagingChannel(projectRootPath).getPath();
        this.reactNativePackager = reactNativePackager;
        this.reactNativePackageStatusIndicator = packagerStatusIndicator;

        /* register handlers for all messages */
        this.messageHandlerDictionary[em.ExtensionMessage.STOP_MONITORING_LOGCAT] = this.stopMonitoringLogCat;
        this.messageHandlerDictionary[em.ExtensionMessage.GET_PACKAGER_PORT] = this.getPackagerPort;
        this.messageHandlerDictionary[em.ExtensionMessage.SEND_TELEMETRY] = this.sendTelemetry;
        this.messageHandlerDictionary[em.ExtensionMessage.OPEN_FILE_AT_LOCATION] = this.openFileAtLocation;
        this.messageHandlerDictionary[em.ExtensionMessage.SHOW_INFORMATION_MESSAGE] = this.showInformationMessage;
        this.messageHandlerDictionary[em.ExtensionMessage.LAUNCH] = this.launch;
    }

    /**
     * Starts the server.
     */
    public setup(): Q.Promise<void> {

        let deferred = Q.defer<void>();

        let launchCallback = (error: any) => {
            this.logger.debug(`Extension messaging server started at ${this.pipePath}.`);
            if (error) {
                deferred.reject(error);
            } else {
                deferred.resolve(void 0);
            }
        };

        this.serverInstance = net.createServer(this.handleSocket.bind(this));
        this.serverInstance.on("error", this.recoverServer.bind(this));
        this.serverInstance.listen(this.pipePath, launchCallback);

        return deferred.promise;
    }

    /**
     * Stops the server.
     */
    public dispose(): void {
        if (this.serverInstance) {
            this.serverInstance.close();
            this.serverInstance = null;
        }

        this.stopMonitoringLogCat();
    }

    /**
     * Message handler for GET_PACKAGER_PORT.
     */
    private getPackagerPort(): Q.Promise<number> {
        return Q(SettingsHelper.getPackagerPort());
    }

    /**
     * Message handler for OPEN_FILE_AT_LOCATION
     */
    private openFileAtLocation(filename: string, lineNumber: number): Q.Promise<PromiseLike<void>> {
        return Q(vscode.workspace.openTextDocument(vscode.Uri.file(filename)).then((document: vscode.TextDocument) => {
            return vscode.window.showTextDocument(document).then((editor: vscode.TextEditor) => {
                let range = editor.document.lineAt(lineNumber - 1).range;
                editor.selection = new vscode.Selection(range.start, range.end);
                editor.revealRange(range, vscode.TextEditorRevealType.InCenter);
            });
        }));
    }

    private stopMonitoringLogCat(): Q.Promise<void> {
        if (this.logCatMonitor) {
            this.logCatMonitor.dispose();
            this.logCatMonitor = null;
        }

        return Q.resolve<void>(void 0);
    }

    /**
     * Sends telemetry
     */
    private sendTelemetry(extensionId: string, extensionVersion: string, appInsightsKey: string, eventName: string, properties: {[key: string]: string}, measures: {[key: string]: number}): Q.Promise<any> {
        Telemetry.sendExtensionTelemetry(extensionId, extensionVersion, appInsightsKey, eventName, properties, measures);
        return Q.resolve({});
    }

    /**
     * Extension message handler.
     */
    private handleExtensionMessage(messageWithArgs: em.MessageWithArguments): Q.Promise<any> {
        let handler = this.messageHandlerDictionary[messageWithArgs.message];
        if (handler) {
            this.logger.info("Handling message: " + em.ExtensionMessage[messageWithArgs.message]);
            return handler.apply(this, messageWithArgs.args);
        } else {
            return Q.reject("Invalid message: " + messageWithArgs.message);
        }
    }

    /**
     * Handles connections to the server.
     */
    private handleSocket(socket: net.Socket): void {
        let handleError = (e: any) => {
            this.logger.error(e);
            socket.end(em.ErrorMarker);
        };

        let dataCallback = (data: any) => {
            try {
                let messageWithArgs: em.MessageWithArguments = JSON.parse(data);
                this.handleExtensionMessage(messageWithArgs)
                    .then(result => {
                        socket.end(JSON.stringify(result));
                    })
                    .catch((e) => { handleError(e); })
                    .done();
            } catch (e) {
                handleError(e);
            }
        };

        socket.on("data", dataCallback);
    }

    /**
     * Recovers the server in case the named socket we use already exists, but no other instance of VSCode is active.
     */
    private recoverServer(error: any): void {
        let errorHandler = (e: any) => {
            /* The named socket is not used. */
            if (e.code === "ECONNREFUSED") {
                new FileSystem().removePathRecursivelyAsync(this.pipePath)
                    .then(() => {
                        if (this.serverInstance) {
                            this.serverInstance.listen(this.pipePath);
                        }
                    })
                    .done();
            }
        };

        /* The named socket already exists. */
        if (error.code === "EADDRINUSE") {
            let clientSocket = new net.Socket();
            clientSocket.on("error", errorHandler);
            clientSocket.connect(this.pipePath, function() {
                clientSocket.end();
            });
        }
    }

    /**
     * Message handler for SHOW_INFORMATION_MESSAGE
     */
    private showInformationMessage(message: string): Q.Promise<void> {
        return Q(vscode.window.showInformationMessage(message)).then(() => {});
    }

    private launch(request: any): Q.Promise<any> {
        let mobilePlatformOptions = requestSetup(request.arguments);

        // We add the parameter if it's defined (adapter crashes otherwise)
        if (!isNullOrUndefined(request.arguments.logCatArguments)) {
            mobilePlatformOptions.logCatArguments = [parseLogCatArguments(request.arguments.logCatArguments)];
        }

        if (!isNullOrUndefined(request.arguments.variant)) {
            mobilePlatformOptions.variant = request.arguments.variant;
        }

        if (!isNullOrUndefined(request.arguments.scheme)) {
            mobilePlatformOptions.scheme = request.arguments.scheme;
        }

        mobilePlatformOptions.packagerPort = SettingsHelper.getPackagerPort();
        const platformDeps: MobilePlatformDeps = {
            packager: this.reactNativePackager,
            packageStatusIndicator: this.reactNativePackageStatusIndicator,
        };
        const mobilePlatform = new PlatformResolver()
            .resolveMobilePlatform(request.arguments.platform, mobilePlatformOptions, platformDeps);
        return TelemetryHelper.generate("launch", (generator) => {
            generator.step("checkPlatformCompatibility");
            TargetPlatformHelper.checkTargetPlatformSupport(mobilePlatformOptions.platform);
            generator.step("startPackager");
            return mobilePlatform.startPackager()
                .then(() => {
                    // We've seen that if we don't prewarm the bundle cache, the app fails on the first attempt to connect to the debugger logic
                    // and the user needs to Reload JS manually. We prewarm it to prevent that issue
                    generator.step("prewarmBundleCache");
                    this.logger.info("Prewarming bundle cache. This may take a while ...");
                    return mobilePlatform.prewarmBundleCache();
                })
                .then(() => {
                    generator.step("mobilePlatform.runApp");
                    this.logger.info("Building and running application.");
                    return mobilePlatform.runApp();
                })
                .then(() => {
                    generator.step("mobilePlatform.enableJSDebuggingMode");
                    return mobilePlatform.enableJSDebuggingMode();
                })
                .catch(error => {
                    throw error;
                });
        });
    }
}

/**
 * Parses log cat arguments to a string
 */
function parseLogCatArguments(userProvidedLogCatArguments: any): string {
    return Array.isArray(userProvidedLogCatArguments)
        ? userProvidedLogCatArguments.join(" ") // If it's an array, we join the arguments
        : userProvidedLogCatArguments; // If not, we leave it as-is
}

function isNullOrUndefined(value: any): boolean {
    return typeof value === "undefined" || value === null;
}

function requestSetup(args: any): any {
    const projectRootPath = getProjectRoot(args);
    let mobilePlatformOptions: any = {
        projectRoot: projectRootPath,
        platform: args.platform,
        targetType: args.targetType || "simulator",
    };

    if (!args.runArguments) {
        let runArgs = SettingsHelper.getRunArgs(args.platform, args.targetType || "simulator");
        mobilePlatformOptions.runArguments = runArgs;
    }

    return mobilePlatformOptions;
}

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
