// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.

import {MessagingChannel} from "./extensionMessaging";
import * as WebSocket from "ws";
import * as rpc from "noice-json-rpc";
import {Telemetry} from "./telemetry";

export class RemoteExtension {
    public static atProjectRootPath(projectRootPath: string) {
        const pipePath = new MessagingChannel(projectRootPath).getPath();

        const api = new rpc.Client(new WebSocket("ws+unix://" + pipePath), {logConsole: true}).api();

        return new RemoteExtension(api);
    }

    constructor(private api: any) {}

    public stopMonitoringLogcat(): Q.Promise<void> {
        return this.api.Extension.stopMonitoringLogcat();
    }

    public sendTelemetry(extensionId: string, extensionVersion: string, appInsightsKey: string, eventName: string,
                         properties?: Telemetry.ITelemetryEventProperties, measures?: Telemetry.ITelemetryEventMeasures): Q.Promise<any> {
        return this.api.Extension.sendTelemetry(extensionId, extensionVersion, appInsightsKey, eventName, properties, measures);
    }

    public openFileAtLocation(filename: string, lineNumber: number): Q.Promise<void> {
        return this.api.Extension.openFileAtLocation(filename, lineNumber);
    }

    public getPackagerPort(): Q.Promise<number> {
        return this.api.Extension.getPackagerPort();
    }

    public showInformationMessage(infoMessage: string): Q.Promise<void> {
        return this.api.Extension.showInformationMessage(infoMessage);
    }

    public launch(request: any): Q.Promise<any> {
        return this.api.Extension.launch(request);
    }
}
