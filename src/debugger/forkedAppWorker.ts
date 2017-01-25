// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.

import * as Q from "q";
import * as path from "path";
import * as child_process from "child_process";
import {ScriptImporter}  from "./scriptImporter";
import {FileSystem} from "../common/node/fileSystem";

import { Log } from "../common/log/log";
import { ErrorHelper } from "../common/error/errorHelper";
import { IDebuggeeWorker, RNAppMessage } from "./appWorker";

// tslint:disable-next-line:align
const WORKER_BOOTSTRAP = `/* global __fbBatchedBridge, self, importScripts, postMessage, onmessage: true */
/* eslint no-unused-vars: 0 */
var onmessage=null, self=global;
process.on("message", function(message){
    if (onmessage) onmessage(message);
});
postMessage = function(message){
    process.send(message);
};
importScripts = function(scriptUrl){
    var scriptCode = require("fs").readFileSync(scriptUrl, "utf8");
    require("vm").runInThisContext(scriptCode, { filename: scriptUrl });
};`;

const WORKER_DONE = `postMessage({workerLoaded:true});`;

function printDebuggingError(message: string, reason: any) {
    Log.logWarning(ErrorHelper.getNestedWarning(reason, `${message}. Debugging won't work: Try reloading the JS from inside the app, or Reconnect the VS Code debugger`));
}

/** This class will run the RN App logic inside a sandbox. The framework to run the logic is provided by the file
 * debuggerWorker.js (designed to run on a WebWorker). We load that file inside a sandbox, and then we use the
 * PROCESS_MESSAGE_INSIDE_SANDBOX script to execute the logic to respond to a message inside the sandbox.
 * The code inside the debuggerWorker.js will call the global function postMessage to send a reply back to the app,
 * so we define our custom function there, so we can handle the message. We also provide our own importScript function
 * to download any script used by debuggerWorker.js
 */
export class ForkedAppWorker implements IDebuggeeWorker {

    private nodeFileSystem: FileSystem = new FileSystem();
    private scriptImporter: ScriptImporter;
    private debuggeeProcess: child_process.ChildProcess = null;
    private workerLoaded = Q.defer<void>();

    constructor(
        private packagerPort: number,
        private sourcesStoragePath: string,
        private debugAdapterPort: number,
        private postReplyToApp: (message: any) => void
    ) {
        this.scriptImporter = new ScriptImporter(packagerPort, sourcesStoragePath);
    }

    public stop() {
        if (this.debuggeeProcess) {
            this.debuggeeProcess.kill();
            this.debuggeeProcess = null;
        }
    }

    public start(): Q.Promise<any> {
        let scriptToRunPath = path.resolve(this.sourcesStoragePath, ScriptImporter.DEBUGGER_WORKER_FILENAME);

        return this.scriptImporter.downloadDebuggerWorker(this.sourcesStoragePath)
        .then(() => this.nodeFileSystem.readFile(scriptToRunPath, "utf8"))
        .then((workerContent: string) => {
            const modifiedDebuggeeContent = [WORKER_BOOTSTRAP, workerContent, WORKER_DONE].join("\n");
            return this.nodeFileSystem.writeFile(scriptToRunPath, modifiedDebuggeeContent);
        })
        .then(() => {
            const port = Math.round(Math.random() * 40000 + 3000);

            this.debuggeeProcess = child_process.fork(scriptToRunPath, [], {
                execArgv: [`--inspect=${port}`/*, "--debug-brk"*/],
            })
            .on("message", (message: any) => {
                if (message && message.workerLoaded) {
                    this.workerLoaded.resolve(void 0);
                    return;
                }

                this.postReplyToApp(message);
            });

            return {port};
        });
    }

    public postMessage(rnMessage: RNAppMessage): void {
        this.workerLoaded.promise
        .then(() => {
            if (rnMessage.method !== "executeApplicationScript") return Q.resolve(rnMessage);

            return this.scriptImporter.downloadAppScript(rnMessage.url)
            .then(downloadedScript =>  Object.assign(Object.assign({}, rnMessage), { url: downloadedScript.filepath }));
        })
        .done((message: RNAppMessage) => this.debuggeeProcess.send({ data: message }),
            reason => printDebuggingError(`Couldn't import script at <${rnMessage.url}>`, reason));
    }
}
