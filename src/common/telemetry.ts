// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.

/// <reference path="../typings/winreg/winreg.d.ts" />

import * as crypto from "crypto";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import * as Q from "q";
import * as winreg from "winreg";
import {HostPlatform} from "../common/hostPlatform";

import {
    ExtensionMessage,
    ExtensionMessageSender,
} from "../common/extensionMessaging";

/**
 * Telemetry module specialized for vscode integration.
 */
export module Telemetry {
    export let appName: string;
    export let isOptedIn: boolean = false;
    export let reporter: ITelemetryReporter;
    export let reporterDictionary: {[key: string]: ITelemetryReporter} = {};

    export interface ITelemetryProperties {
        [propertyName: string]: any;
    };

    /**
     * TelemetryEvent represents a basic telemetry data point
     */
    export class TelemetryEvent {
        public name: string;
        public properties: ITelemetryProperties;
        private static PII_HASH_KEY: string = "959069c9-9e93-4fa1-bf16-3f8120d7db0c";
        private eventId: string;

        constructor(name: string, properties?: ITelemetryProperties) {
            this.name = name;
            this.properties = properties || {};

            this.eventId = TelemetryUtils.generateGuid();
        }

        public setPiiProperty(name: string, value: string): void {
            let hmac: any = crypto.createHmac("sha256", new Buffer(TelemetryEvent.PII_HASH_KEY, "utf8"));
            let hashedValue: any = hmac.update(value).digest("hex");

            this.properties[name] = hashedValue;

            if (Telemetry.isInternal()) {
                this.properties[name + ".nothashed"] = value;
            }
        }
    };

    /**
     * TelemetryActivity automatically includes timing data, used for scenarios where we want to track performance.
     * Calls to start() and end() are optional, if not called explicitly then the constructor will be the start and send will be the end.
     * This event will include a property called reserved.activity.duration which represents time in milliseconds.
     */
    export class TelemetryActivity extends TelemetryEvent {
        private startTime: number[];
        private endTime: number[];

        constructor(name: string, properties?: ITelemetryProperties) {
            super(name, properties);
            this.start();
        }

        public start(): void {
            this.startTime = process.hrtime();
        }

        public end(): void {
            if (!this.endTime) {
                this.endTime = process.hrtime(this.startTime);

                // convert [seconds, nanoseconds] to milliseconds and include as property
                this.properties["reserved.activity.duration"] = this.endTime[0] * 1000 + this.endTime[1] / 1000000;
            }
        }
    };

    export interface ITelemetryInitOptions {
        isExtensionProcess: boolean;
    }

    export function init(appNameValue: string, appVersion?: string, initOptions?: ITelemetryInitOptions): Q.Promise<any> {
        try {
            Telemetry.appName = appNameValue;
            return TelemetryUtils.init(appVersion, initOptions);
        } catch (err) {
            console.error(err);
        }
    }

    export function send(event: TelemetryEvent, ignoreOptIn: boolean = false): void {
        if (Telemetry.isOptedIn || ignoreOptIn) {
            TelemetryUtils.addCommonProperties(event);

            try {
                if (event instanceof TelemetryActivity) {
                    (<TelemetryActivity>event).end();
                }

                if (Telemetry.reporter) {
                    let properties: ITelemetryEventProperties = {};
                    let measures: ITelemetryEventMeasures = {};

                    Object.keys(event.properties || {}).forEach(function(key: string) {
                        switch (typeof event.properties[key]) {
                            case "string":
                                properties[key] = <string>event.properties[key];
                                break;

                            case "number":
                                measures[key] = <number>event.properties[key];
                                break;

                            default:
                                properties[key] = JSON.stringify(event.properties[key]);
                                break;
                        }
                    });

                    Telemetry.reporter.sendTelemetryEvent(event.name, properties, measures);
                }

            } catch (err) {
                console.error(err);
            }
        }
    }

    export function isInternal(): boolean {
        return TelemetryUtils.userType === TelemetryUtils.USERTYPE_INTERNAL;
    }

    export function getSessionId(): string {
        return TelemetryUtils.sessionId;
    }

    export function setSessionId(sessionId: string): void {
        TelemetryUtils.sessionId = sessionId;
    }

    interface ITelemetrySettings {
        [settingKey: string]: any;
        userId?: string;
        machineId?: string;
        optIn?: boolean;
        userType?: string;
    }

    class TelemetryUtils {
        public static USERTYPE_INTERNAL: string = "Internal";
        public static USERTYPE_EXTERNAL: string = "External";
        public static userType: string;
        public static sessionId: string;
        public static optInCollectedForCurrentSession: boolean;

        private static userId: string;
        private static telemetrySettings: ITelemetrySettings = null;
        private static TELEMETRY_SETTINGS_FILENAME: string = "VSCodeTelemetrySettings.json";
        private static APPINSIGHTS_INSTRUMENTATIONKEY: string = "AIF-d9b70cd4-b9f9-4d70-929b-a071c400b217"; // Matches vscode telemetry key
        private static REGISTRY_SQMCLIENT_NODE: string = "\\SOFTWARE\\Microsoft\\SQMClient";
        private static REGISTRY_USERID_VALUE: string = "UserId";
        private static INTERNAL_DOMAIN_SUFFIX: string = "microsoft.com";
        private static INTERNAL_USER_ENV_VAR: string = "TACOINTERNAL";

        private static get telemetrySettingsFile(): string {
            let settingsHome = HostPlatform.getSettingsHome();
            return path.join(settingsHome, TelemetryUtils.TELEMETRY_SETTINGS_FILENAME);
        }

        public static init(appVersion: string, initOptions: ITelemetryInitOptions): Q.Promise<any> {
            TelemetryUtils.loadSettings();

            if (initOptions.isExtensionProcess) {
                let TelemetryReporter = require("vscode-extension-telemetry").default;
                Telemetry.reporter = new TelemetryReporter(Telemetry.appName, appVersion, TelemetryUtils.APPINSIGHTS_INSTRUMENTATIONKEY);
            } else {
                Telemetry.reporter = new ExtensionTelemetryReporter(Telemetry.appName, appVersion, TelemetryUtils.APPINSIGHTS_INSTRUMENTATIONKEY);
            }

            return Q.all([TelemetryUtils.getUserId()])
            .spread<any>(function(userId: string): void {
                TelemetryUtils.userId = userId;
                TelemetryUtils.userType = TelemetryUtils.getUserType();

                Telemetry.isOptedIn = TelemetryUtils.getTelemetryOptInSetting();
                TelemetryUtils.saveSettings();
            });
        }

        public static addCommonProperties(event: any): void {
            if (Telemetry.isOptedIn) {
                event.properties["RN.userId"] = TelemetryUtils.userId;
            }

            event.properties["RN.userType"] = TelemetryUtils.userType;
        }

        public static generateGuid(): string {
            let hexValues: string[] = ["0", "1", "2", "3", "4", "5", "6", "7", "8", "9", "A", "B", "C", "D", "E", "F"];
            // c.f. rfc4122 (UUID version 4 = xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx)
            let oct: string = "";
            let tmp: number;
            /* tslint:disable:no-bitwise */
            for (let a: number = 0; a < 4; a++) {
                tmp = (4294967296 * Math.random()) | 0;
                oct += hexValues[tmp & 0xF] + hexValues[tmp >> 4 & 0xF] + hexValues[tmp >> 8 & 0xF] + hexValues[tmp >> 12 & 0xF] + hexValues[tmp >> 16 & 0xF] + hexValues[tmp >> 20 & 0xF] + hexValues[tmp >> 24 & 0xF] + hexValues[tmp >> 28 & 0xF];
            }

            // "Set the two most significant bits (bits 6 and 7) of the clock_seq_hi_and_reserved to zero and one, respectively"
            let clockSequenceHi: string = hexValues[8 + (Math.random() * 4) | 0];
            return oct.substr(0, 8) + "-" + oct.substr(9, 4) + "-4" + oct.substr(13, 3) + "-" + clockSequenceHi + oct.substr(16, 3) + "-" + oct.substr(19, 12);
            /* tslint:enable:no-bitwise */
        }

        public static getTelemetryOptInSetting(): boolean {
            if (TelemetryUtils.telemetrySettings.optIn === undefined) {
                // Opt-in by default
                TelemetryUtils.telemetrySettings.optIn = true;
            }

            return TelemetryUtils.telemetrySettings.optIn;
        }

        public static setTelemetryOptInSetting(optIn: boolean): void {
            TelemetryUtils.telemetrySettings.optIn = optIn;

            if (!optIn) {
                Telemetry.send(new TelemetryEvent(Telemetry.appName + "/telemetryOptOut"), true);
            }

            TelemetryUtils.optInCollectedForCurrentSession = true;
            TelemetryUtils.saveSettings();
        }

        private static getUserType(): string {
            let userType: string = TelemetryUtils.telemetrySettings.userType;

            if (userType === undefined) {
            if (process.env[TelemetryUtils.INTERNAL_USER_ENV_VAR]) {
                userType = TelemetryUtils.USERTYPE_INTERNAL;
            } else {
                let domain: string = process.env.USERDNSDOMAIN;
                domain = domain ? domain.toLowerCase().substring(domain.length - TelemetryUtils.INTERNAL_DOMAIN_SUFFIX.length) : null;
                userType = domain === TelemetryUtils.INTERNAL_DOMAIN_SUFFIX ? TelemetryUtils.USERTYPE_INTERNAL : TelemetryUtils.USERTYPE_EXTERNAL;
            }

            TelemetryUtils.telemetrySettings.userType = userType;
        }

            return userType;
        }

        private static getRegistryValue(key: string, value: string, hive: string): Q.Promise<string> {
            let deferred: Q.Deferred<string> = Q.defer<string>();
            let regKey = new winreg({
                                    hive: hive,
                                    key: key,
                            });
            regKey.get(value, function(err: any, itemValue: winreg.RegistryItem) {
                if (err) {
                    // Fail gracefully by returning null if there was an error.
                    deferred.resolve(null);
                } else {
                    deferred.resolve(itemValue.value);
                }
            });

            return deferred.promise;
        }

        /*
            * Load settings data from settingsHome/TelemetrySettings.json
            */
        private static loadSettings(): ITelemetrySettings {
            try {
                TelemetryUtils.telemetrySettings = JSON.parse(<any>fs.readFileSync(TelemetryUtils.telemetrySettingsFile));
            } catch (e) {
                // if file does not exist or fails to parse then assume no settings are saved and start over
                TelemetryUtils.telemetrySettings = {};
            }

            return TelemetryUtils.telemetrySettings;
        }

        /*
            * Save settings data in settingsHome/TelemetrySettings.json
            */
        private static saveSettings(): void {
            let settingsHome = HostPlatform.getSettingsHome();
            if (!fs.existsSync(settingsHome)) {
                fs.mkdirSync(settingsHome);
            }

            fs.writeFileSync(TelemetryUtils.telemetrySettingsFile, JSON.stringify(TelemetryUtils.telemetrySettings));
        }

        private static getUniqueId(regValue: string, regHive: string, fallback: () => string): Q.Promise<any> {
            let uniqueId: string;
            if (os.platform() === "win32") {
                return TelemetryUtils.getRegistryValue(TelemetryUtils.REGISTRY_SQMCLIENT_NODE, regValue, regHive)
                .then(function(id: string): Q.Promise<string> {
                    if (id) {
                        uniqueId = id.replace(/[{}]/g, "");
                        return Q.resolve(uniqueId);
                    } else {
                        return Q.resolve(fallback());
                    }
                });
            } else {
                return Q.resolve(fallback());
            }
        }

        private static getUserId(): Q.Promise<string> {
            let userId: string = TelemetryUtils.telemetrySettings.userId;
            if (!userId) {
                return TelemetryUtils.getUniqueId(TelemetryUtils.REGISTRY_USERID_VALUE, winreg.HKCU, TelemetryUtils.generateGuid)
                .then(function(id: string): Q.Promise<string> {
                    TelemetryUtils.telemetrySettings.userId = id;
                    return Q.resolve(id);
                });
            } else {
                TelemetryUtils.telemetrySettings.userId = userId;
                return Q.resolve(userId);
            }
        }
    };

    export interface ITelemetryEventProperties {
        [key: string]: string;
    }

    export interface ITelemetryEventMeasures {
        [key: string]: number;
    }

    export interface ITelemetryReporter {
        sendTelemetryEvent(eventName: string, properties?: ITelemetryEventProperties, measures?: ITelemetryEventMeasures): void;
    }

    class ExtensionTelemetryReporter implements ITelemetryReporter {
        private extensionMessageSender: ExtensionMessageSender;
        private extensionId: string;
        private extensionVersion: string;
        private appInsightsKey: string;

        constructor(extensionId: string, extensionVersion: string, key: string) {
            this.extensionId = extensionId;
            this.extensionVersion = extensionVersion;
            this.appInsightsKey = key;
            this.extensionMessageSender = new ExtensionMessageSender();
        }

        public sendTelemetryEvent(eventName: string, properties?: ITelemetryEventProperties, measures?: ITelemetryEventMeasures): void {
            this.extensionMessageSender.sendMessage(ExtensionMessage.SEND_TELEMETRY, [this.extensionId, this.extensionVersion, this.appInsightsKey, eventName, properties, measures])
            .catch(function(){});
        }
    }

    export function sendExtensionTelemetry(extensionId: string, extensionVersion: string, appInsightsKey: string, eventName: string, properties: ITelemetryEventProperties, measures: ITelemetryEventMeasures): void {
        let extensionTelemetryReporter: ITelemetryReporter = Telemetry.reporterDictionary[extensionId];

        if (!extensionTelemetryReporter) {
            let TelemetryReporter = require("vscode-extension-telemetry").default;
            Telemetry.reporterDictionary[extensionId] = new TelemetryReporter(extensionId, extensionVersion, appInsightsKey);
            reporter = Telemetry.reporterDictionary[extensionId];
        }

        extensionTelemetryReporter.sendTelemetryEvent(eventName, properties, measures);
    }
};
