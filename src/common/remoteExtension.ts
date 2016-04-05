// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.

import {ExtensionMessage, MessagingChannel} from "./extensionMessaging";
import {InterProcessMessageSender} from "./interProcessMessageSender";

export class RemoteExtension {
    private interProcessMessageSender: InterProcessMessageSender;

    constructor(private projectRootPath: string) {
        const remoteExtensionServerPath = new MessagingChannel(projectRootPath).getPath();
        this.interProcessMessageSender = new InterProcessMessageSender(remoteExtensionServerPath);
    }

    public startPackager(): Q.Promise<void> {
        return this.interProcessMessageSender.sendMessage(ExtensionMessage.START_PACKAGER);
    }

    public prewarmBundleCache(platform: string): Q.Promise<void> {
        return this.interProcessMessageSender.sendMessage(ExtensionMessage.PREWARM_BUNDLE_CACHE, [platform]);
    }

    public startMonitoringLogcat(debugTarget: string, logCatArguments: string): Q.Promise<void> {
        return this.interProcessMessageSender.sendMessage(ExtensionMessage.START_MONITORING_LOGCAT, [debugTarget, logCatArguments]);
    }

    public stopMonitoringLocat(): Q.Promise<void> {
        return this.interProcessMessageSender.sendMessage(ExtensionMessage.STOP_MONITORING_LOGCAT);
    }

    public sendTelemetry(extensionId: string, extensionVersion: string, appInsightsKey: string, eventName: string,
                         properties: { [key: string]: string }, measures: { [key: string]: number }): Q.Promise<any> {
        return this.interProcessMessageSender.sendMessage(ExtensionMessage.SEND_TELEMETRY,
            [extensionId, extensionVersion, appInsightsKey, eventName, properties, measures]);
    }
}