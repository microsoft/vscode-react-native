import * as vm from "vm";
import * as fs from "fs";
import * as Q from "q";
import * as path from "path";
import * as websocket from "websocket";
import {ScriptImporter}  from "./scriptImporter";
import {Packager}  from "./packager";
import {Log} from "../utils/commands/log";

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

export class SandboxedAppWorker {
    private sourcesStoragePath: string;
    private postReplyToApp: (message: any) => void;

    private sandbox: DebuggerWorkerSandbox;
    private sandboxContext: vm.Context;

    private isAnswerReady = Q({});

    constructor(sourcesStoragePath: string, postReplyToApp: (message: any) => void) {
        this.sourcesStoragePath = sourcesStoragePath;
        this.postReplyToApp = postReplyToApp;
    }

    private runInSandbox(filename: string, fileContents?: string) {
        if (!fileContents) {
            fileContents = fs.readFileSync(filename).toString();
        }

        vm.runInContext(fileContents, this.sandboxContext, filename);
    }

    public start(): SandboxedAppWorker {
        let scriptToRunPath = require.resolve(path.join(this.sourcesStoragePath, "debuggerWorker"));
        this.initializeSandboxAndContext(scriptToRunPath);
        let fileContents = fs.readFileSync(scriptToRunPath).toString();
        // On a debugger worker the onmessage variable already exist. We need to declare it before the
        // javascript file can assign it. We do it in the first line without a new line to not break
        // the debugging experience of debugging debuggerWorker.js itself (as part of the extension)
        this.runInSandbox(scriptToRunPath, "var onmessage = null; " + fileContents);
        return this;
    }

    public postMessage(object: any): void {
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
        // The debugger worker gives a replay synchronically. We use the promise to make that replay
        // get blocked until the script gets actually imported
        let defer = Q.defer<{}>();
        this.isAnswerReady = defer.promise;

        // The next line converts to any due to the incorrect typing on node.d.ts of vm.runInThisContext
        new ScriptImporter(this.sourcesStoragePath).download(url)
            .then(downloadedScript =>
                this.runInSandbox(downloadedScript.filepath, downloadedScript.contents))
            .done(() =>
                defer.resolve({})); // Now we let the reply to the app proceed
    }

    private gotResponseFromDebuggerWorker(object: any): void {
        // We might need to hold the response until a script is imported
        this.isAnswerReady.done(() =>
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

    public start() {
        this.singleLifetimeWorker = new SandboxedAppWorker(this.sourcesStoragePath, (message) =>
            this.sendMessageToApp(message)).start();
        this.socketToApp = this.createSocketToApp();
    }

    private createSocketToApp() {
        let socketToApp = new WebSocket(this.debuggerProxyUrl());
        socketToApp.onopen = () => this.socketToAppWasOpened();
        socketToApp.onclose = () => this.socketWasClosed();
        socketToApp.onmessage = (message: any) => this.messageReceivedFromApp(message);
        return socketToApp;
    }

    private debuggerProxyUrl() {
        return `ws://${Packager.HOST}/debugger-proxy`;
    }

    private socketToAppWasOpened() {
        Log.logMessage("Established a connection with the Proxy (Packager) to the React Native application");
    }

    private socketWasClosed() {
        Log.logMessage("Disconnected from the Proxy (Packager) to the React Native application. Retrying reconnection soon...");
        setTimeout(this.start, 100);
    }

    private messageReceivedFromApp(message: any) {
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
    }

    private gotPrepareJSRuntime(message: any): void {
        // Create the sandbox, and replay that we finished processing the message
        this.sendMessageToApp({ replyID: parseInt(message.id, 10) });
    }

    private sendMessageToApp(message: any) {
        this.socketToApp.send(JSON.stringify(message));
    }
}
