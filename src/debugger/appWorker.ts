// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.

import * as vm from "vm";
import * as Q from "q";
import * as path from "path";
import * as WebSocket from "ws";
import {ScriptImporter}  from "./scriptImporter";
import {Packager}  from "../common/packager";
import {ErrorHelper} from "../common/error/errorHelper";
import {Log} from "../common/log/log";
import {LogLevel} from "../common/log/logHelper";
import {FileSystem} from "../common/node/fileSystem";
import {ExecutionsLimiter} from "../common/executionsLimiter";

import Module = require("module");

// This file is a replacement of: https://github.com/facebook/react-native/blob/8d397b4cbc05ad801cfafb421cee39bcfe89711d/local-cli/server/util/debugger.html for Node.JS
interface DebuggerWorkerSandbox {
    __debug__: {
        // To support simulating native functionality when debugging,
        // we expose a node require function to the app
        require: (id: string) => any;
    };
    __filename: string;
    __dirname: string;
    self: DebuggerWorkerSandbox;
    console: typeof console;
    require: (id: string) => any;
    importScripts: (url: string) => void;
    postMessage: (object: any) => void;
    onmessage: (object: RNAppMessage) => void;
    postMessageArgument: RNAppMessage; // We use this argument to pass messages to the worker
}

interface RNAppMessage {
    method: string;
    // These objects have also other properties but that we don't currently use
}

function printDebuggingError(message: string, reason: any) {
    Log.logWarning(ErrorHelper.getNestedWarning(reason, `${message}. Debugging won't work: Try reloading the JS from inside the app, or Reconnect the VS Code debugger`));
}

export class SandboxedAppWorker {
    /** This class will run the RN App logic inside a sandbox. The framework to run the logic is provided by the file
     * debuggerWorker.js (designed to run on a WebWorker). We load that file inside a sandbox, and then we use the
     * PROCESS_MESSAGE_INSIDE_SANDBOX script to execute the logic to respond to a message inside the sandbox.
     * The code inside the debuggerWorker.js will call the global function postMessage to send a reply back to the app,
     * so we define our custom function there, so we can handle the message. We also provide our own importScript function
     * to download any script used by debuggerWorker.js
     */
    private packagerPort: number;
    private sourcesStoragePath: string;
    private debugAdapterPort: number;
    private postReplyToApp: (message: any) => void;

    private sandbox: DebuggerWorkerSandbox;
    private sandboxContext: vm.Context;
    private scriptToReceiveMessageInSandbox: vm.Script;

    private pendingScriptImport = Q(void 0);

    private nodeFileSystem: FileSystem;
    private scriptImporter: ScriptImporter;

    private static PROCESS_MESSAGE_INSIDE_SANDBOX = "onmessage({ data: postMessageArgument });";

    constructor(packagerPort: number, sourcesStoragePath: string, debugAdapterPort: number, postReplyToApp: (message: any) => void, {
        nodeFileSystem = new FileSystem(),
        scriptImporter = new ScriptImporter(packagerPort, sourcesStoragePath),
    } = {}) {
        this.packagerPort = packagerPort;
        this.sourcesStoragePath = sourcesStoragePath;
        this.debugAdapterPort = debugAdapterPort;
        this.postReplyToApp = postReplyToApp;
        this.scriptToReceiveMessageInSandbox = new vm.Script(SandboxedAppWorker.PROCESS_MESSAGE_INSIDE_SANDBOX);

        this.nodeFileSystem = nodeFileSystem;
        this.scriptImporter = scriptImporter;
    }

    public start(): Q.Promise<void> {
        let scriptToRunPath = require.resolve(path.join(this.sourcesStoragePath, ScriptImporter.DEBUGGER_WORKER_FILE_BASENAME));
        this.initializeSandboxAndContext(scriptToRunPath);
        return this.readFileContents(scriptToRunPath).then(fileContents =>
            // On a debugger worker the onmessage variable already exist. We need to declare it before the
            // javascript file can assign it. We do it in the first line without a new line to not break
            // the debugging experience of debugging debuggerWorker.js itself (as part of the extension)
            this.runInSandbox(scriptToRunPath, "var onmessage = null; " + fileContents));
    }

    public postMessage(object: RNAppMessage): void {
        this.sandbox.postMessageArgument = object;
        this.scriptToReceiveMessageInSandbox.runInContext(this.sandboxContext);
    }

    private initializeSandboxAndContext(scriptToRunPath: string): void {
        let scriptToRunModule = new Module(scriptToRunPath);
        scriptToRunModule.paths = Module._nodeModulePaths(path.dirname(scriptToRunPath));
        // In order for __debug_.require("aNonInternalPackage") to work, we need to initialize where
        // node searches for packages. We invoke the same method that node does:
        // https://github.com/nodejs/node/blob/de1dc0ae2eb52842b5c5c974090123a64c3a594c/lib/module.js#L452

        this.sandbox = {
            __debug__: {
                require: (filePath: string) => scriptToRunModule.require(filePath),
            },
            __filename: scriptToRunPath,
            __dirname: path.dirname(scriptToRunPath),
            self: null,
            console: console,
            require: (filePath: string) => scriptToRunModule.require(filePath), // Give the sandbox access to require("<filePath>");
            importScripts: (url: string) => this.importScripts(url), // Import script like using <script/>
            postMessage: (object: any) => this.gotResponseFromDebuggerWorker(object), // Post message back to the UI thread
            onmessage: null,
            postMessageArgument: null,
        };
        this.sandbox.self = this.sandbox;

        this.sandboxContext = vm.createContext(this.sandbox);
    }

    private runInSandbox(filename: string, fileContents?: string): Q.Promise<void> {
        let fileContentsPromise = fileContents
            ? Q(fileContents)
            : this.readFileContents(filename);

        return fileContentsPromise.then(contents => {
            vm.runInContext(contents, this.sandboxContext, filename);
        });
    }

    private readFileContents(filename: string) {
        return this.nodeFileSystem.readFile(filename).then(contents => contents.toString());
    }

    private importScripts(url: string): void {
        /* The debuggerWorker.js executes this code:
            importScripts(message.url);
            sendReply();

            In the original code importScripts is a sync call. In our code it's async, so we need to mess with sendReply() so we won't
            actually send the reply back to the application until after importScripts has finished executing. We use
            this.pendingScriptImport to make the gotResponseFromDebuggerWorker() method hold the reply back, until've finished importing
            and running the script */
        let defer = Q.defer<{}>();
        this.pendingScriptImport = defer.promise;

        // The next line converts to any due to the incorrect typing on node.d.ts of vm.runInThisContext
        this.scriptImporter.downloadAppScript(url, this.debugAdapterPort)
            .then(downloadedScript =>
                this.runInSandbox(downloadedScript.filepath, downloadedScript.contents))
            .done(() => {
                // Now we let the reply to the app proceed
                defer.resolve({});
            }, reason => {
                printDebuggingError(`Couldn't import script at <${url}>`, reason);
            });
    }

    private gotResponseFromDebuggerWorker(object: any): void {
        // We might need to hold the response until a script is imported. See comments on this.importScripts()
        this.pendingScriptImport.done(() =>
            this.postReplyToApp(object), reason => {
                printDebuggingError("Unexpected internal error while processing a message from the RN App.", reason);
            });
    }
}

export class MultipleLifetimesAppWorker {
    /** This class will create a SandboxedAppWorker that will run the RN App logic, and then create a socket
     * and send the RN App messages to the SandboxedAppWorker. The only RN App message that this class handles
     * is the prepareJSRuntime, which we reply to the RN App that the sandbox was created successfully.
     * When the socket closes, we'll create a new SandboxedAppWorker and a new socket pair and discard the old ones.
     */
    private packagerPort: number;
    private sourcesStoragePath: string;
    private debugAdapterPort: number;
    private socketToApp: WebSocket;
    private singleLifetimeWorker: SandboxedAppWorker;

    private sandboxedAppConstructor: (storagePath: string, adapterPort: number, messageFunction: (message: any) => void) => SandboxedAppWorker;
    private webSocketConstructor: (url: string) => WebSocket;

    private executionLimiter = new ExecutionsLimiter();

    constructor(packagerPort: number, sourcesStoragePath: string, debugAdapterPort: number, {
        sandboxedAppConstructor = (path: string, port: number, messageFunc: (message: any) => void) =>
            new SandboxedAppWorker(packagerPort, path, port, messageFunc),
        webSocketConstructor = (url: string) => new WebSocket(url),
    } = {}) {
        this.packagerPort = packagerPort;
        this.sourcesStoragePath = sourcesStoragePath;
        this.debugAdapterPort = debugAdapterPort;
        console.assert(!!this.sourcesStoragePath, "The sourcesStoragePath argument was null or empty");

        this.sandboxedAppConstructor = sandboxedAppConstructor;
        this.webSocketConstructor = webSocketConstructor;
    }

    public start(warnOnFailure: boolean = false): Q.Promise<any> {
        return Packager.isPackagerRunning(Packager.getHostForPort(this.packagerPort))
            .then(running => {
                if (running) {
                    return this.createSocketToApp(warnOnFailure);
                }
                throw new Error(`Cannot attach to packager. Are you sure there is a packager and it is running in the port ${this.packagerPort}? If your packager is configured to run in another port make sure to add that to the setting.json.`);
            });
    }

    private startNewWorkerLifetime(): Q.Promise<void> {
        this.singleLifetimeWorker = this.sandboxedAppConstructor(this.sourcesStoragePath, this.debugAdapterPort, (message) => {
            this.sendMessageToApp(message);
        });
        Log.logInternalMessage(LogLevel.Info, "A new app worker lifetime was created.");
        return this.singleLifetimeWorker.start();
    }

    private createSocketToApp(warnOnFailure: boolean = false): Q.Promise<void> {
        let deferred = Q.defer<void>();
        this.socketToApp = this.webSocketConstructor(this.debuggerProxyUrl());
        this.socketToApp.on("open", () => {
            this.onSocketOpened();
        });
        this.socketToApp.on("close",
            () => {
                this.executionLimiter.execute("onSocketClose.msg", /*limitInSeconds*/ 10, () => {
                    /*
                     * It is not the best idea to compare with the message, but this is the only thing React Native gives that is unique when
                     * it closes the socket because it already has a connection to a debugger.
                     * https://github.com/facebook/react-native/blob/588f01e9982775f0699c7bfd56623d4ed3949810/local-cli/server/util/webSocketProxy.js#L38
                     */
                    if (this.socketToApp._closeMessage === "Another debugger is already connected") {
                        deferred.reject(new RangeError("Another debugger is already connected to packager. Please close it before trying to debug with VSCode."));
                    }
                    Log.logMessage("Disconnected from the Proxy (Packager) to the React Native application. Retrying reconnection soon...");
                });
                setTimeout(() => {
                  this.start(true /* retryAttempt */);
                }, 100);
            });
        this.socketToApp.on("message",
            (message: any) => this.onMessage(message));
        this.socketToApp.on("error",
            (error: Error) => {
                if (warnOnFailure) {
                    Log.logWarning(ErrorHelper.getNestedWarning(error,
                        "Reconnection to the proxy (Packager) failed. Please check the output window for Packager errors, if any. If failure persists, please restart the React Native debugger."));
                }

                deferred.reject(error);
            });

        // In an attempt to catch failures in starting the packager on first attempt,
        // wait for 300 ms before resolving the promise
        Q.delay(300).done(() => deferred.resolve(void 0));
        return deferred.promise;
    }

    private debuggerProxyUrl() {
        return `ws://${Packager.getHostForPort(this.packagerPort)}/debugger-proxy?role=debugger&name=vscode`;
    }

    private onSocketOpened() {
        this.executionLimiter.execute("onSocketOpened.msg", /*limitInSeconds*/ 10, () =>
            Log.logMessage("Established a connection with the Proxy (Packager) to the React Native application"));
    }

    private onMessage(message: string) {
        try {
            Log.logInternalMessage(LogLevel.Trace, "From RN APP: " + message);
            let object = <RNAppMessage>JSON.parse(message);
            if (object.method === "prepareJSRuntime") {
                // The MultipleLifetimesAppWorker will handle prepareJSRuntime aka create new lifetime
                this.gotPrepareJSRuntime(object);
            } else if (object.method === "$disconnected") {
                // We need to shutdown the current app worker, and create a new lifetime
                this.singleLifetimeWorker = null;
            } else if (object.method) {
                // All the other messages are handled by the single lifetime worker
                this.singleLifetimeWorker.postMessage(object);
            } else {
                // Message doesn't have a method. Ignore it. This is an info message instead of warn because it's normal and expected
                Log.logInternalMessage(LogLevel.Info, "The react-native app sent a message without specifying a method: " + message);
            }
        } catch (exception) {
            printDebuggingError(`Failed to process message from the React Native app. Message:\n${message}`, exception);
        }
    }

    private gotPrepareJSRuntime(message: any): void {
        // Create the sandbox, and replay that we finished processing the message
        this.startNewWorkerLifetime().done(() => {
            this.sendMessageToApp({ replyID: parseInt(message.id, 10) });
        }, error => printDebuggingError(`Failed to prepare the JavaScript runtime environment. Message:\n${message}`, error));
    }

    private sendMessageToApp(message: any): void {
        let stringified: string = null;
        try {
            stringified = JSON.stringify(message);
            Log.logInternalMessage(LogLevel.Trace, "To RN APP: " + stringified);
            this.socketToApp.send(stringified);
        } catch (exception) {
            let messageToShow = stringified || ("" + message); // Try to show the stringified version, but show the toString if unavailable
            printDebuggingError(`Failed to send message to the React Native app. Message:\n${messageToShow}`, exception);
        }
    }
}
