// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.

import * as vm from "vm";
import * as Q from "q";
import * as path from "path";
import * as WebSocket from "ws";
import {ScriptImporter}  from "./scriptImporter";
import {Packager}  from "../common/packager";
import {Log, LogLevel} from "../common/log";
import {Node} from "../common/node/node";

import Module = require("module");

// This file is a replacement of: https://github.com/facebook/react-native/blob/8d397b4cbc05ad801cfafb421cee39bcfe89711d/local-cli/server/util/debugger.html for Node.JS

interface DebuggerWorkerSandbox {
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
    Log.logWarning(`${message}. Debugging won't work: Try reloading the JS from inside the app, or Reconnect the VS Code debugger`, reason);
}

export class SandboxedAppWorker {
    /** This class will run the RN App logic inside a sandbox. The framework to run the logic is provided by the file
     * debuggerWorker.js (designed to run on a WebWorker). We load that file inside a sandbox, and then we use the
     * PROCESS_MESSAGE_INSIDE_SANDBOX script to execute the logic to respond to a message inside the sandbox.
     * The code inside the debuggerWorker.js will call the global function postMessage to send a reply back to the app,
     * so we define our custom function there, so we can handle the message. We also provide our own importScript function
     * to download any script used by debuggerWorker.js
     */
    private sourcesStoragePath: string;
    private debugAdapterPort: number;
    private postReplyToApp: (message: any) => void;

    private sandbox: DebuggerWorkerSandbox;
    private sandboxContext: vm.Context;
    private scriptToReceiveMessageInSandbox: vm.Script;

    private pendingScriptImport = Q(void 0);

    private static PROCESS_MESSAGE_INSIDE_SANDBOX = "onmessage({ data: postMessageArgument });";

    constructor(sourcesStoragePath: string, debugAdapterPort: number, postReplyToApp: (message: any) => void) {
        this.sourcesStoragePath = sourcesStoragePath;
        this.debugAdapterPort = debugAdapterPort;
        this.postReplyToApp = postReplyToApp;
        this.scriptToReceiveMessageInSandbox = new vm.Script(SandboxedAppWorker.PROCESS_MESSAGE_INSIDE_SANDBOX);
    }

    public start(): Q.Promise<void> {
        let scriptToRunPath = require.resolve(path.join(this.sourcesStoragePath, Packager.DEBUGGER_WORKER_FILE_BASENAME));
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

        this.sandbox = {
            __filename: scriptToRunPath,
            __dirname: path.dirname(scriptToRunPath),
            self: null,
            console: console,
            require: (filePath: string) => scriptToRunModule.require(filePath), // Give the sandbox access to require("<filePath>");
            importScripts: (url: string) => this.importScripts(url), // Import script like using <script/>
            postMessage: (object: any) => this.gotResponseFromDebuggerWorker(object), // Post message back to the UI thread
            onmessage: null,
            postMessageArgument: null
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
        return new Node.FileSystem().readFile(filename).then(contents => contents.toString());
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
        new ScriptImporter(this.sourcesStoragePath, this.debugAdapterPort).download(url)
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
     * is the prepareJSRuntime, which we reply to the RN App that the sandbox was created succesfully.
     * When the socket closes, we'll create a new SandboxedAppWorker and a new socket pair and discard the old ones.
     */
    private sourcesStoragePath: string;
    private debugAdapterPort: number;
    private socketToApp: WebSocket;
    private singleLifetimeWorker: SandboxedAppWorker;

    constructor(sourcesStoragePath: string, debugAdapterPort: number) {
        this.sourcesStoragePath = sourcesStoragePath;
        this.debugAdapterPort = debugAdapterPort;
        console.assert(!!this.sourcesStoragePath, "The sourcesStoragePath argument was null or empty");
    }

    public start(): Q.Promise<void> {
        this.singleLifetimeWorker = new SandboxedAppWorker(this.sourcesStoragePath, this.debugAdapterPort, (message) => {
            this.sendMessageToApp(message);
        });
        return this.singleLifetimeWorker.start().then(() => {
            this.socketToApp = this.createSocketToApp();
        });
    }

    private createSocketToApp() {
        let socketToApp = new WebSocket(this.debuggerProxyUrl());
        socketToApp.on("open", () =>
            this.onSocketOpened());
        socketToApp.on("close", () =>
            this.onSocketClose());
        socketToApp.on("message",
            (message: any) => this.onMessage(message));
        socketToApp.on("error",
            (error: Error) => printDebuggingError("An error ocurred while using the socket to communicate with the React Native app", error));
        return socketToApp;
    }

    private debuggerProxyUrl() {
        return `ws://${Packager.HOST}/debugger-proxy?role=debugger&name=React%20Native%20Tools`;
    }

    private onSocketOpened() {
        Log.logMessage("Established a connection with the Proxy (Packager) to the React Native application");
    }

    private onSocketClose() {
        // TODO: Add some logic to not print this message that often, we'll spam the user
        Log.logMessage("Disconnected from the Proxy (Packager) to the React Native application. Retrying reconnection soon...");
        setTimeout(() => this.start(), 100);
    }

    private onMessage(message: string) {
        try {
            Log.logInternalMessage(LogLevel.Trace, "From RN APP: " + message);
            let object = <RNAppMessage>JSON.parse(message);
            if (object.method === "prepareJSRuntime") {
                // The MultipleLifetimesAppWorker will handle prepareJSRuntime aka create new lifetime
                this.gotPrepareJSRuntime(object);
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
        this.sendMessageToApp({ replyID: parseInt(message.id, 10) });
    }

    private sendMessageToApp(message: any) {
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
