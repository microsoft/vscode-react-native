// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.

import {RemoteExtension} from "../common/remoteExtension";
import {Telemetry} from "./telemetry";

export class ExtensionTelemetryReporter implements Telemetry.ITelemetryReporter {
    private remoteExtension: RemoteExtension;
    private extensionId: string;
    private extensionVersion: string;
    private appInsightsKey: string;

    constructor(extensionId: string, extensionVersion: string, key: string, projectRootPath: string) {
        this.extensionId = extensionId;
        this.extensionVersion = extensionVersion;
        this.appInsightsKey = key;
        this.remoteExtension = RemoteExtension.atProjectRootPath(projectRootPath);
    }

    public sendTelemetryEvent(eventName: string, properties?: Telemetry.ITelemetryEventProperties, measures?: Telemetry.ITelemetryEventMeasures): void {
        this.remoteExtension.sendTelemetry(this.extensionId, this.extensionVersion, this.appInsightsKey, eventName, properties, measures)
            .catch(function() { });
    }
}

export class NullTelemetryReporter implements Telemetry.ITelemetryReporter {
    public sendTelemetryEvent(eventName: string, properties?: Telemetry.ITelemetryEventProperties, measures?: Telemetry.ITelemetryEventMeasures): void {
        // Don't do anything
    }
}

export class ReassignableTelemetryReporter implements Telemetry.ITelemetryReporter {
    private reporter: Telemetry.ITelemetryReporter;

    constructor(initialReporter: Telemetry.ITelemetryReporter) {
        this.reporter = initialReporter;
    }

    public reassignTo(reporter: Telemetry.ITelemetryReporter) {
        this.reporter = reporter;
    }

    public sendTelemetryEvent(eventName: string, properties?: Telemetry.ITelemetryEventProperties, measures?: Telemetry.ITelemetryEventMeasures): void {
        this.reporter.sendTelemetryEvent(eventName, properties, measures);
    }
}
