// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.

import { LogCatMonitor } from "./logCatMonitor";

export class LogCatMonitorManager {
    public static readonly logCatMonitorsCache: { [key: string]: LogCatMonitor } = {};

    public static addMonitor(monitor: LogCatMonitor): void {
        this.logCatMonitorsCache[monitor.deviceId.toLowerCase()] = monitor;
    }

    public static getMonitor(deviceId: string): LogCatMonitor {
        return this.logCatMonitorsCache[deviceId.toLowerCase()];
    }

    public static delMonitor(deviceId: string): void {
        if (this.logCatMonitorsCache[deviceId.toLowerCase()]) {
            this.logCatMonitorsCache[deviceId.toLowerCase()].dispose();
            delete this.logCatMonitorsCache[deviceId.toLowerCase()];
        }
    }

    public static cleanUp(): void {
        Object.keys(LogCatMonitorManager.logCatMonitorsCache).forEach(monitor => {
            LogCatMonitorManager.delMonitor(monitor);
        });
    }
}
