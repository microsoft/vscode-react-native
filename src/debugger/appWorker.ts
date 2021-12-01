// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.

import * as path from "path";
import { EventEmitter } from "events";
import * as vscode from "vscode";
import * as WebSocket from "ws";
import { logger } from "vscode-debugadapter";
import * as nls from "vscode-nls";
import { ensurePackagerRunning } from "../common/packagerStatus";
import { ErrorHelper } from "../common/error/errorHelper";
import { ExecutionsLimiter } from "../common/executionsLimiter";
import { ReactNativeProjectHelper } from "../common/reactNativeProjectHelper";
import { InternalErrorCode } from "../common/error/internalErrorCode";
import { FileSystem } from "../common/node/fileSystem";
import { PromiseUtil } from "../common/node/promise";
import { ForkedAppWorker } from "./forkedAppWorker";
import { ScriptImporter } from "./scriptImporter";

nls.config({
    messageFormat: nls.MessageFormat.bundle,
    bundleFormat: nls.BundleFormat.standalone,
})();
const localize = nls.loadMessageBundle();

export interface RNAppMessage {
    method: string;
    url?: string;
    // These objects have also other properties but that we don't currently use
}

export interface IDebuggeeWorker {
    start(): Promise<any>;
    stop(): void;
    postMessage(message: RNAppMessage): void;
}

function printDebuggingError(error: Error, reason: any) {
    const nestedError = ErrorHelper.getNestedError(
        error,
        InternalErrorCode.DebuggingWontWorkReloadJSAndReconnect,
        reason,
    );

    logger.error(nestedError.message);
}

/** This class will create a SandboxedAppWorker that will run the RN App logic, and then create a socket
 * and send the RN App messages to the SandboxedAppWorker. The only RN App message that this class handles
 * is the prepareJSRuntime, which we reply to the RN App that the sandbox was created successfully.
 * When the socket closes, we'll create a new SandboxedAppWorker and a new socket pair and discard the old ones.
 */

export class MultipleLifetimesAppWorker extends EventEmitter {
    public static WORKER_BOOTSTRAP = `
// Initialize some variables before react-native code would access them
var onmessage=null, self=global;
// Cache Node's original require as __debug__.require
global.__debug__={require: require};
// Prevent leaking process.versions from debugger process to
// worker because pure React Native doesn't do that and some packages as js-md5 rely on this behavior
Object.defineProperty(process, "versions", {
    value: undefined
});

// TODO: Replace by url.fileURLToPath method when Node 10 LTS become deprecated
function fileUrlToPath(url) {
  if (process.platform === 'win32') {
      return url.toString().replace('file:///', '');
  } else {
    return url.toString().replace('file://', '');
  }
}

function getNativeModules() {
    var NativeModules;
    try {
        // This approach is for old RN versions
        NativeModules = global.require('NativeModules');
    } catch (err) {
        // ignore error and try another way for more recent RN versions
        try {
            var nativeModuleId;
            var modules = global.__r.getModules();
            var ids = Object.keys(modules);
            for (var i = 0; i < ids.length; i++) {
              if (modules[ids[i]].verboseName) {
                 var packagePath = new String(modules[ids[i]].verboseName);
                 if (packagePath.indexOf('Libraries/BatchedBridge/NativeModules.js') > 0 || packagePath.indexOf('Libraries\\\\BatchedBridge\\\\NativeModules.js') > 0) {
                   nativeModuleId = parseInt(ids[i], 10);
                   break;
                 }
              }
            }
          if (nativeModuleId) {
            NativeModules = global.__r(nativeModuleId);
          }
        }
        catch (err) {
            // suppress errors
        }
    }
    return NativeModules;
}

// Originally, this was made for iOS only
var vscodeHandlers = {
    'vscode_reloadApp': function () {
        var NativeModules = getNativeModules();
        if (NativeModules && NativeModules.DevSettings) {
            NativeModules.DevSettings.reload();
        }
    },
    'vscode_showDevMenu': function () {
        var NativeModules = getNativeModules();
        if (NativeModules && NativeModules.DevMenu) {
            NativeModules.DevMenu.show();
        }
    }
};

process.on("message", function (message) {
    if (message.data && vscodeHandlers[message.data.method]) {
        vscodeHandlers[message.data.method]();
    } else if(onmessage) {
        onmessage(message);
    }
});

var postMessage = function(message){
    process.send(message);
};

if (!self.postMessage) {
    self.postMessage = postMessage;
}

var importScripts = (function(){
    var fs=require('fs'), vm=require('vm');
    return function(scriptUrl){
        scriptUrl = fileUrlToPath(scriptUrl);
        var scriptCode = fs.readFileSync(scriptUrl, 'utf8');
        // Add a 'debugger;' statement to stop code execution
        // to wait for the sourcemaps to be processed by the debug adapter
        vm.runInThisContext('debugger;' + scriptCode, {filename: scriptUrl});
    };
})();
`;

    public static CONSOLE_TRACE_PATCH = `// Worker is ran as nodejs process, so console.trace() writes to stderr and it leads to error in native app
// To avoid this console.trace() is overridden to print stacktrace via console.log()
// Please, see Node JS implementation: https://github.com/nodejs/node/blob/master/lib/internal/console/constructor.js
console.trace = (function() {
    return function() {
        try {
            var err = {
                name: 'Trace',
                message: require('util').format.apply(null, arguments)
                };
            // Node uses 10, but usually it's not enough for RN app trace
            Error.stackTraceLimit = 30;
            Error.captureStackTrace(err, console.trace);
            console.log(err.stack);
        } catch (e) {
            console.error(e);
        }
    };
})();
`;

    public static PROCESS_TO_STRING_PATCH = `// As worker is ran in node, it breaks broadcast-channels package approach of identifying if it’s ran in node:
// https://github.com/pubkey/broadcast-channel/blob/master/src/util.js#L64
// To avoid it if process.toString() is called if will return empty string instead of [object process].
var nativeObjectToString = Object.prototype.toString;
Object.prototype.toString = function() {
    if (this === process) {
        return '';
    } else {
        return nativeObjectToString.call(this);
    }
};
`;

    public static WORKER_DONE = `// Notify debugger that we're done with loading
// and started listening for IPC messages
postMessage({workerLoaded:true});`;

    public static FETCH_STUB = `(function(self) {
'use strict';

if (self.fetch) {
    return;
}

self.fetch = fetch;

function fetch(url) {
    return new Promise((resolve, reject) => {
        var data = require('fs').readFileSync(fileUrlToPath(url), 'utf8');
        resolve(
            {
                text: function () {
                    return data;
                }
            });
    });
}
})(global);
`;

    private packagerAddress: string;
    private packagerPort: number;
    private sourcesStoragePath: string;
    private projectRootPath: string;
    private packagerRemoteRoot?: string;
    private packagerLocalRoot?: string;
    private debuggerWorkerUrlPath?: string;
    private socketToApp: WebSocket;
    private cancellationToken: vscode.CancellationToken;
    private singleLifetimeWorker: IDebuggeeWorker | null;
    private webSocketConstructor: (url: string) => WebSocket;

    private executionLimiter = new ExecutionsLimiter();
    private nodeFileSystem = new FileSystem();
    private scriptImporter: ScriptImporter;

    constructor(
        attachRequestArguments: any,
        sourcesStoragePath: string,
        projectRootPath: string,
        cancellationToken: vscode.CancellationToken,
        { webSocketConstructor = (url: string) => new WebSocket(url) } = {},
    ) {
        super();
        this.packagerAddress = attachRequestArguments.address || "localhost";
        this.packagerPort = attachRequestArguments.port;
        this.packagerRemoteRoot = attachRequestArguments.remoteRoot;
        this.packagerLocalRoot = attachRequestArguments.localRoot;
        this.debuggerWorkerUrlPath = attachRequestArguments.debuggerWorkerUrlPath;
        this.sourcesStoragePath = sourcesStoragePath;
        this.projectRootPath = projectRootPath;
        this.cancellationToken = cancellationToken;
        if (!this.sourcesStoragePath)
            throw ErrorHelper.getInternalError(InternalErrorCode.SourcesStoragePathIsNullOrEmpty);
        this.webSocketConstructor = webSocketConstructor;
        this.scriptImporter = new ScriptImporter(
            this.packagerAddress,
            this.packagerPort,
            sourcesStoragePath,
            this.packagerRemoteRoot,
            this.packagerLocalRoot,
        );
    }

    public async start(retryAttempt: boolean = false): Promise<void> {
        const errPackagerNotRunning = ErrorHelper.getInternalError(
            InternalErrorCode.CannotAttachToPackagerCheckPackagerRunningOnPort,
            this.packagerPort,
        );

        await ensurePackagerRunning(this.packagerAddress, this.packagerPort, errPackagerNotRunning);
        // Don't fetch debugger worker on socket disconnect
        if (!retryAttempt) {
            await this.downloadAndPatchDebuggerWorker();
        }
        return this.createSocketToApp(retryAttempt);
    }

    public stop(): void {
        if (this.socketToApp) {
            this.socketToApp.removeAllListeners();
            this.socketToApp.close();
        }

        if (this.singleLifetimeWorker) {
            this.singleLifetimeWorker.stop();
        }
    }

    public async downloadAndPatchDebuggerWorker(): Promise<void> {
        const scriptToRunPath = path.resolve(
            this.sourcesStoragePath,
            ScriptImporter.DEBUGGER_WORKER_FILENAME,
        );

        await this.scriptImporter.downloadDebuggerWorker(
            this.sourcesStoragePath,
            this.projectRootPath,
            this.debuggerWorkerUrlPath,
        );
        const workerContent = await this.nodeFileSystem.readFile(scriptToRunPath, "utf8");
        const isHaulProject = ReactNativeProjectHelper.isHaulProject(this.projectRootPath);
        // Add our customizations to debugger worker to get it working smoothly
        // in Node env and polyfill WebWorkers API over Node's IPC.
        const modifiedDebuggeeContent = [
            MultipleLifetimesAppWorker.WORKER_BOOTSTRAP,
            MultipleLifetimesAppWorker.CONSOLE_TRACE_PATCH,
            MultipleLifetimesAppWorker.PROCESS_TO_STRING_PATCH,
            isHaulProject ? MultipleLifetimesAppWorker.FETCH_STUB : null,
            workerContent,
            MultipleLifetimesAppWorker.WORKER_DONE,
        ].join("\n");
        return this.nodeFileSystem.writeFile(scriptToRunPath, modifiedDebuggeeContent);
    }

    public showDevMenuCommand(): void {
        if (this.singleLifetimeWorker) {
            this.singleLifetimeWorker.postMessage({
                method: "vscode_showDevMenu",
            });
        }
    }

    public reloadAppCommand(): void {
        if (this.singleLifetimeWorker) {
            this.singleLifetimeWorker.postMessage({
                method: "vscode_reloadApp",
            });
        }
    }

    private async startNewWorkerLifetime(): Promise<void> {
        this.singleLifetimeWorker = new ForkedAppWorker(
            this.packagerAddress,
            this.packagerPort,
            this.sourcesStoragePath,
            this.projectRootPath,
            message => {
                this.sendMessageToApp(message);
            },
            this.packagerRemoteRoot,
            this.packagerLocalRoot,
        );
        logger.verbose("A new app worker lifetime was created.");
        const startedEvent = await this.singleLifetimeWorker.start();
        this.emit("connected", startedEvent);
    }

    private async createSocketToApp(retryAttempt: boolean = false): Promise<void> {
        return new Promise((resolve, reject) => {
            this.socketToApp = this.webSocketConstructor(this.debuggerProxyUrl());
            this.socketToApp.on("open", () => {
                this.onSocketOpened();
            });
            this.socketToApp.on("close", () => {
                this.executionLimiter.execute("onSocketClose.msg", /* limitInSeconds*/ 10, () => {
                    /*
                     * It is not the best idea to compare with the message, but this is the only thing React Native gives that is unique when
                     * it closes the socket because it already has a connection to a debugger.
                     * https://github.com/facebook/react-native/blob/588f01e9982775f0699c7bfd56623d4ed3949810/local-cli/server/util/webSocketProxy.js#L38
                     */
                    const msgKey = "_closeMessage";
                    if (this.socketToApp[msgKey] === "Another debugger is already connected") {
                        reject(
                            ErrorHelper.getInternalError(
                                InternalErrorCode.AnotherDebuggerConnectedToPackager,
                            ),
                        );
                    }
                    logger.log(
                        localize(
                            "DisconnectedFromThePackagerToReactNative",
                            "Disconnected from the Proxy (Packager) to the React Native application. Retrying reconnection soon...",
                        ),
                    );
                });
                if (!this.cancellationToken.isCancellationRequested) {
                    setTimeout(() => {
                        void this.start(true /* retryAttempt */);
                    }, 100);
                }
            });
            this.socketToApp.on("message", (message: any) => this.onMessage(message));
            this.socketToApp.on("error", (error: Error) => {
                if (retryAttempt) {
                    printDebuggingError(
                        ErrorHelper.getInternalError(
                            InternalErrorCode.ReconnectionToPackagerFailedCheckForErrorsOrRestartReactNative,
                        ),
                        error,
                    );
                }

                reject(error);
            });

            // In an attempt to catch failures in starting the packager on first attempt,
            // wait for 300 ms before resolving the promise
            void PromiseUtil.delay(300).then(() => resolve());
        });
    }

    private debuggerProxyUrl() {
        return `ws://${this.packagerAddress}:${this.packagerPort}/debugger-proxy?role=debugger&name=vscode`;
    }

    private onSocketOpened() {
        this.executionLimiter.execute("onSocketOpened.msg", /* limitInSeconds*/ 10, () =>
            logger.log(
                localize(
                    "EstablishedConnectionWithPackagerToReactNativeApp",
                    "Established a connection with the Proxy (Packager) to the React Native application",
                ),
            ),
        );
    }

    private killWorker() {
        if (!this.singleLifetimeWorker) return;
        this.singleLifetimeWorker.stop();
        this.singleLifetimeWorker = null;
    }

    private onMessage(message: string) {
        try {
            logger.verbose("From RN APP: " + message);
            const object = <RNAppMessage>JSON.parse(message);
            if (object.method === "prepareJSRuntime") {
                // In RN 0.40 Android runtime doesn't seem to be sending "$disconnected" event
                // when user reloads an app, hence we need to try to kill it here either.
                this.killWorker();
                // The MultipleLifetimesAppWorker will handle prepareJSRuntime aka create new lifetime
                this.gotPrepareJSRuntime(object);
            } else if (object.method === "$disconnected") {
                // We need to shutdown the current app worker, and create a new lifetime
                this.killWorker();
            } else if (object.method) {
                // All the other messages are handled by the single lifetime worker
                if (this.singleLifetimeWorker) {
                    this.singleLifetimeWorker.postMessage(object);
                }
            } else {
                // Message doesn't have a method. Ignore it. This is an info message instead of warn because it's normal and expected
                logger.verbose(
                    `The react-native app sent a message without specifying a method: ${message}`,
                );
            }
        } catch (exception) {
            printDebuggingError(
                ErrorHelper.getInternalError(
                    InternalErrorCode.FailedToProcessMessageFromReactNativeApp,
                    message,
                ),
                exception,
            );
        }
    }

    private gotPrepareJSRuntime(message: any): void {
        // Create the sandbox, and replay that we finished processing the message
        this.startNewWorkerLifetime().then(
            () => {
                this.sendMessageToApp({ replyID: parseInt(message.id, 10) });
            },
            error =>
                printDebuggingError(
                    ErrorHelper.getInternalError(
                        InternalErrorCode.FailedToPrepareJSRuntimeEnvironment,
                        message,
                    ),
                    error,
                ),
        );
    }

    private sendMessageToApp(message: any): void {
        let stringified = "";
        try {
            stringified = JSON.stringify(message);
            logger.verbose(`To RN APP: ${stringified}`);
            this.socketToApp.send(stringified);
        } catch (exception) {
            const messageToShow = stringified || String(message); // Try to show the stringified version, but show the toString if unavailable
            printDebuggingError(
                ErrorHelper.getInternalError(
                    InternalErrorCode.FailedToSendMessageToTheReactNativeApp,
                    messageToShow,
                ),
                exception,
            );
        }
    }
}
