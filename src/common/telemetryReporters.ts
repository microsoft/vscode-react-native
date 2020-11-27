// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.

import {Telemetry} from "./telemetry";

export class RemoteTelemetryReporter implements Telemetry.ITelemetryReporter {
    private extensionId: string;
    private extensionVersion: string;
    private appInsightsKey: string;

    constructor(extensionId: string, extensionVersion: string, key: string) {
        this.extensionId = extensionId;
        this.extensionVersion = extensionVersion;
        this.appInsightsKey = key;
    }
    public sendTelemetryEvent(eventName: string, properties?: Telemetry.ITelemetryEventProperties, measures?: Telemetry.ITelemetryEventMeasures): void {
        try {
            Telemetry.sendExtensionTelemetry(this.extensionId, this.extensionVersion, this.appInsightsKey, eventName, properties, measures);
        } catch (err) {
            // don't notify a user
        }
    }
}

export class NullTelemetryReporter implements Telemetry.ITelemetryReporter {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    public sendTelemetryEvent(eventName: string, properties?: Telemetry.ITelemetryEventProperties, measures?: Telemetry.ITelemetryEventMeasures): void {
        // Don't do anything
    }
}

export class ReassignableTelemetryReporter implements Telemetry.ITelemetryReporter {
    private reporter: Telemetry.ITelemetryReporter;

    constructor(initialReporter: Telemetry.ITelemetryReporter) {
        this.reporter = initialReporter;
    }

    public reassignTo(reporter: Telemetry.ITelemetryReporter): void {
        this.reporter = reporter;
    }

    public sendTelemetryEvent(eventName: string, properties?: Telemetry.ITelemetryEventProperties, measures?: Telemetry.ITelemetryEventMeasures): void {
        this.reporter.sendTelemetryEvent(eventName, properties, measures);
    }
}
