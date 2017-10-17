// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.

import {MessagingHelper} from "./extensionMessaging";
import * as WebSocket from "ws";
import * as rpc from "noice-json-rpc";
import {Telemetry} from "./telemetry";

export interface ICommonApi {
    expose(methods: any): void;
}
export interface IExtensionApi extends ICommonApi {
    stopMonitoringLogcat(): Q.Promise<void>;
    sendTelemetry(extensionId: string, extensionVersion: string, appInsightsKey: string, eventName: string,
                  properties?: Telemetry.ITelemetryEventProperties, measures?: Telemetry.ITelemetryEventMeasures): Q.Promise<any>;
    openFileAtLocation(filename: string, lineNumber: number): Q.Promise<void>;
    getPackagerPort(): Q.Promise<number>;
    showInformationMessage(infoMessage: string): Q.Promise<void>;
    launch(request: any): Q.Promise<any>;
    showDevMenu(deviceId?: string): Q.Promise<any>;
    reloadApp(deviceId?: string): Q.Promise<any>;
}

export interface IDebuggerApi extends ICommonApi {
    onShowDevMenu(handler: () => void): Q.Promise<any>;
    onReloadApp(handler: () => void): Q.Promise<any>;
    emitShowDevMenu(deviceId?: string): Q.Promise<any>;
    emitReloadApp(deviceId?: string): Q.Promise<any>;
}
export interface IRemoteExtension {
    Extension: IExtensionApi;
    Debugger: IDebuggerApi;
}

export class RemoteExtension {
    public static atProjectRootPath(projectRootPath: string) {
        const pipePath = MessagingHelper.getPath(projectRootPath);
        let ws = new WebSocket("ws+unix://" + pipePath);
        ws.on("error", (err) => {
            console.error(err);
        });
        const _api: IRemoteExtension = new rpc.Client(ws).api();

        return new RemoteExtension(_api);
    }

    constructor(private _api: IRemoteExtension) {}

    public get api(): IRemoteExtension {
        return this._api;
    }

    public stopMonitoringLogcat(): Q.Promise<void> {
        return this._api.Extension.stopMonitoringLogcat();
    }

    public sendTelemetry(extensionId: string, extensionVersion: string, appInsightsKey: string, eventName: string,
                         properties?: Telemetry.ITelemetryEventProperties, measures?: Telemetry.ITelemetryEventMeasures): Q.Promise<any> {
        return this._api.Extension.sendTelemetry(extensionId, extensionVersion, appInsightsKey, eventName, properties, measures);
    }

    public openFileAtLocation(filename: string, lineNumber: number): Q.Promise<void> {
        return this._api.Extension.openFileAtLocation(filename, lineNumber);
    }

    public getPackagerPort(program: string): Q.Promise<number> {
        return this._api.Extension.getPackagerPort();
    }

    public showInformationMessage(infoMessage: string): Q.Promise<void> {
        return this._api.Extension.showInformationMessage(infoMessage);
    }

    public launch(request: any): Q.Promise<any> {
        return this._api.Extension.launch(request);
    }

    public showDevMenu(deviceId?: string): Q.Promise<any> {
        return this._api.Extension.showDevMenu(deviceId);
    }

    public reloadApp(deviceId?: string): Q.Promise<any> {
        return this._api.Extension.reloadApp(deviceId);
    }
}
