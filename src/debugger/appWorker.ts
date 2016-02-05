import * as vm from "vm";
import * as Q from "q";
import * as path from "path";
import * as websocket from "websocket";
import {ScriptImporter}  from "./scriptImporter";
import {Packager}  from "./packager";
import {Log} from "../utils/commands/log";
import {Node} from "../utils/node/node";

import Module = require("module");

let WebSocket = (<any>websocket).w3cwebsocket;

// This file is a replacement of: https://github.com/facebook/react-native/blob/8d397b4cbc05ad801cfafb421cee39bcfe89711d/local-cli/server/util/debugger.html for Node.JS

interface DebuggerWorkerSandbox {
    __filename: string;
    __dirname: string;
    self: DebuggerWorkerSandbox;
    console: any;
    require: (filePath: string) => any;
    importScripts: (url: string) => void;
    postMessage: (object: any) => void;
    onmessage: (object: any) => void;
}


function printDebuggingFatalError(message: string, reason: any) {
    Log.logError(`${message}. Debugging won't work: Try reloading the JS from inside the app, or Reconnect the VS Code debugger`, reason, true);
}

export class SandboxedAppWorker {
    private sourcesStoragePath: string;
    private postReplyToApp: (message: any) => void;

    private sandbox: DebuggerWorkerSandbox;
    private sandboxContext: vm.Context;

    private pendingScriptImport = Q(void 0);

    constructor(sourcesStoragePath: string, postReplyToApp: (message: any) => void) {
        this.sourcesStoragePath = sourcesStoragePath;
        this.postReplyToApp = postReplyToApp;
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

    public start(): Q.Promise<void> {
        let scriptToRunPath = require.resolve(path.join(this.sourcesStoragePath, Packager.DEBUGGER_WORKER_FILE_BASENAME));
        this.initializeSandboxAndContext(scriptToRunPath);
        return this.readFileContents(scriptToRunPath).then(fileContents =>
            // On a debugger worker the onmessage variable already exist. We need to declare it before the
            // javascript file can assign it. We do it in the first line without a new line to not break
            // the debugging experience of debugging debuggerWorker.js itself (as part of the extension)
            this.runInSandbox(scriptToRunPath, "var onmessage = null; " + fileContents));
    }

    public postMessage(object: any): void {
        // TODO: Run this call inside of the sandbox
        this.sandbox.onmessage({ data: object });
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
            onmessage: null
        };
        this.sandbox.self = this.sandbox;

        this.sandboxContext = vm.createContext(this.sandbox);
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
        new ScriptImporter(this.sourcesStoragePath).download(url)
            .then(downloadedScript =>
                this.runInSandbox(downloadedScript.filepath, downloadedScript.contents))
            .done(() => {
                // Now we let the reply to the app proceed
                defer.resolve({});
            }, reason => {
                printDebuggingFatalError(`Couldn't import script at <${url}>`, reason);
            });
    }

    private gotResponseFromDebuggerWorker(object: any): void {
        // We might need to hold the response until a script is imported. See comments on this.importScripts()
        this.pendingScriptImport.done(() =>
            this.postReplyToApp(object));
    }
}

export class MultipleLifetimesAppWorker {
    private sourcesStoragePath: string;
    private socketToApp: any;
    private singleLifetimeWorker: SandboxedAppWorker;

    constructor(sourcesStoragePath: string) {
        this.sourcesStoragePath = sourcesStoragePath;
    }

    public start(): Q.Promise<void> {
        this.singleLifetimeWorker = new SandboxedAppWorker(this.sourcesStoragePath, (message) => {
            this.sendMessageToApp(message);
        });
        return this.singleLifetimeWorker.start().then(() => {
            this.socketToApp = this.createSocketToApp();
        });
    }

    private createSocketToApp() {
        let socketToApp = new WebSocket(this.debuggerProxyUrl());
        socketToApp.onopen = () => this.socketToAppWasOpened();
        socketToApp.onclose = () => this.socketWasClosed();
        socketToApp.onmessage = (message: any) => this.messageReceivedFromApp(message);
        // TODO: Add on error handler
        return socketToApp;
    }

    private debuggerProxyUrl() {
        return `ws://${Packager.HOST}/debugger-proxy`;
    }

    private socketToAppWasOpened() {
        Log.logMessage("Established a connection with the Proxy (Packager) to the React Native application");
    }

    private socketWasClosed() {
        // TODO: Add some logic to not print this message that often, we'll spam the user
        Log.logMessage("Disconnected from the Proxy (Packager) to the React Native application. Retrying reconnection soon...");
        setTimeout(() => this.start(), 100);
    }

    // TODO: Add proper typings for message
    private messageReceivedFromApp(message: any) {
        try {
            let object = JSON.parse(message.data);
            if (object.method === "prepareJSRuntime") {
                // The MultipleLifetimesAppWorker will handle prepareJSRuntime aka create new lifetime
                this.gotPrepareJSRuntime(object);
            } else if (object.method) {
                // All the other messages are handled by the single lifetime worker
                this.singleLifetimeWorker.postMessage(object);
            } else {
                // Message doesn't have a method. Ignore it.
                Log.logInternalMessage("The react-native app sent a message without specifying a method: " + message);
            }
        } catch (exception) {
            printDebuggingFatalError(`Failed to process message from the React Native app. Message:\n${message}`, exception);
        }
    }

    private gotPrepareJSRuntime(message: any): void {
        // Create the sandbox, and replay that we finished processing the message
        this.sendMessageToApp({ replyID: parseInt(message.id, 10) });
    }

    private sendMessageToApp(message: any) {
        this.socketToApp.send(JSON.stringify(message));
    }
}
