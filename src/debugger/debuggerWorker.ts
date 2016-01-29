/// <reference path="../typings/vscode-react-native/vscode-react-native" />

let PACKAGER = "localhost:8081";

import * as websocket from "websocket";
import {ScriptImporter}  from "./scriptImporter";
import {Log} from "../utils/commands/log";

let DebuggerWebSocket = (<any>websocket).w3cwebsocket;

/* global __fbBatchedBridge */
/* eslint no-unused-vars: 0 */

export class DebuggerWorker {
    private ws: any;

    private projectRootPath: string;

    constructor(projectRootPath: string) {
        this.projectRootPath = projectRootPath;
    }

    private messageHandlers: any = {
        "prepareJSRuntime": function (message: any, cb: any) {
            Log.logMessage("React Native worker got prepareJSRuntime");
            cb();
        },
        "executeApplicationScript": (message: any, cb: any) => {
            Log.logMessage("React Native worker got executeApplicationScript");
            /* tslint:disable:forin */
            for (let key in message.inject) {
            /* tslint:enable:forin */
                (<any>global)[key] = JSON.parse(message.inject[key]);
            }
            // importScripts(message.url, cb);
            new ScriptImporter(this.projectRootPath).import(message.url).done(() => cb());
        },
        "executeBridgeJSCall": function (object: any, cb: any) {
            // Other methods get called on the bridge
            let returnValue: any[][] = [[], [], [], [], []];
            try {
            if (typeof __fbBatchedBridge === "object") {
                returnValue = __fbBatchedBridge[object.method].apply(null, object.arguments);
            }
            } finally {
                cb(JSON.stringify(returnValue));
            }
        }
    };

    private createSocket() {
        this.ws = new DebuggerWebSocket("ws://" + PACKAGER + "/debugger-proxy");

        this.ws.onopen = () => {
            Log.logMessage("WebSocket connection opened");
        };
        this.ws.onclose = () => {
            Log.logMessage("WebSocket connection closed");
            setTimeout(() => this.ws = this.createSocket(), 1000);
        };

        this.ws.onmessage = (message: any) => {
            let object = JSON.parse(message.data);
            if (!object.method) {
                return;
            }

            let handler = this.messageHandlers[object.method];
            if (!handler) {
                handler = this.messageHandlers.executeBridgeJSCall;
            }
            handler(object, (result: any) => {
                let response = JSON.stringify({
                    replyID: object.id,
                    result: result
                });
                this.ws.send(response);
            });
        };

        return this.ws;
    }

    public start() {
        this.ws = this.createSocket();
    }
}
