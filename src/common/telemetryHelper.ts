// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.

import * as Q from "q";
import {Telemetry} from "./telemetry";
import {TelemetryGenerator, IHasErrorCode} from "./telemetryGenerators";

export interface ITelemetryPropertyInfo {
    value: any;
    isPii: boolean;
}

export interface ICommandTelemetryProperties {
    [propertyName: string]: ITelemetryPropertyInfo;
}

export interface IExternalTelemetryProvider {
    sendTelemetry: (event: string, props: Telemetry.ITelemetryProperties, error?: Error) => void;
}

export class TelemetryHelper {
    public static sendSimpleEvent(eventName: string, properties?: Telemetry.ITelemetryProperties): void {
        const event = TelemetryHelper.createTelemetryEvent(eventName, properties);
        Telemetry.send(event);
    }
    public static createTelemetryEvent(eventName: string, properties?: Telemetry.ITelemetryProperties): Telemetry.TelemetryEvent {
        return new Telemetry.TelemetryEvent(eventName, properties);
    }

    public static telemetryProperty(propertyValue: any, pii?: boolean): ITelemetryPropertyInfo {
        return { value: String(propertyValue), isPii: pii || false };
    }

    public static addTelemetryEventProperties(event: Telemetry.TelemetryEvent, properties: ICommandTelemetryProperties): void {
        if (!properties) {
            return;
        }

        Object.keys(properties).forEach(function (propertyName: string): void {
            TelemetryHelper.addTelemetryEventProperty(event, propertyName, properties[propertyName].value, properties[propertyName].isPii);
        });
    }

    public static sendErrorEvent(eventName: string, error: Error) {
        const event = TelemetryHelper.createTelemetryEvent(eventName);
        let errorWithErrorCode: IHasErrorCode = <IHasErrorCode> <Object> error;
        if (errorWithErrorCode.errorCode) {
            this.addTelemetryEventProperty(event, "error.message", errorWithErrorCode.errorCode, false);

        } else {
            this.addTelemetryEventProperty(event, "error.code", error.message, true);
        }
        Telemetry.send(event);
    }

    public static sendCommandSuccessTelemetry(commandName: string, commandProperties: ICommandTelemetryProperties, args: string[] = []): void {
        let successEvent: Telemetry.TelemetryEvent = TelemetryHelper.createBasicCommandTelemetry(commandName, args);

        TelemetryHelper.addTelemetryEventProperties(successEvent, commandProperties);

        Telemetry.send(successEvent);
    }

    public static addTelemetryEventProperty(event: Telemetry.TelemetryEvent, propertyName: string, propertyValue: any, isPii: boolean): void {
        if (Array.isArray(propertyValue)) {
            TelemetryHelper.addMultiValuedTelemetryEventProperty(event, propertyName, propertyValue, isPii);
        } else {
            TelemetryHelper.setTelemetryEventProperty(event, propertyName, propertyValue, isPii);
        }
    }

    public static addPropertiesFromOptions(telemetryProperties: ICommandTelemetryProperties, knownOptions: any, commandOptions: { [flag: string]: any }, nonPiiOptions: string[] = []): ICommandTelemetryProperties {
        // We parse only the known options, to avoid potential private information that may appear on the command line
        let unknownOptionIndex: number = 1;
        Object.keys(commandOptions).forEach((key: string) => {
            let value: any = commandOptions[key];
            if (Object.keys(knownOptions).indexOf(key) >= 0) {
                // This is a known option. We"ll check the list to decide if it"s pii or not
                if (typeof (value) !== "undefined") {
                    // We encrypt all options values unless they are specifically marked as nonPii
                    telemetryProperties["options." + key] = this.telemetryProperty(value, nonPiiOptions.indexOf(key) < 0);
                }
            } else {
                // This is a not known option. We"ll assume that both the option and the value are pii
                telemetryProperties["unknownOption" + unknownOptionIndex + ".name"] = this.telemetryProperty(key, /*isPii*/ true);
                telemetryProperties["unknownOption" + unknownOptionIndex++ + ".value"] = this.telemetryProperty(value, /*isPii*/ true);
            }
        });
        return telemetryProperties;
    }

    public static generate<T>(name: string, extendedParamsToSend: ICommandTelemetryProperties = {}, codeGeneratingTelemetry: { (telemetry: TelemetryGenerator): Q.Promise<T> | T }): Q.Promise<T> {
        let generator: TelemetryGenerator = new TelemetryGenerator(name, extendedParamsToSend);
        return generator.time("", () => codeGeneratingTelemetry(generator)).finally(() => generator.send());
    }

    private static createBasicCommandTelemetry(commandName: string, args: string[] = []): Telemetry.TelemetryEvent {
        let commandEvent: Telemetry.TelemetryEvent = new Telemetry.TelemetryEvent(commandName || "command");

        if (!commandName && args && args.length > 0) {
            commandEvent.setPiiProperty("command", args[0]);
        }

        if (args) {
            TelemetryHelper.addTelemetryEventProperty(commandEvent, "argument", args, true);
        }

        return commandEvent;
    }

    private static setTelemetryEventProperty(event: Telemetry.TelemetryEvent, propertyName: string, propertyValue: string, isPii: boolean): void {
        if (isPii) {
            event.setPiiProperty(propertyName, String(propertyValue));
        } else {
            event.properties[propertyName] = String(propertyValue);
        }
    }

    private static addMultiValuedTelemetryEventProperty(event: Telemetry.TelemetryEvent, propertyName: string, propertyValue: any, isPii: boolean): void {
        for (let i: number = 0; i < propertyValue.length; i++) {
            TelemetryHelper.setTelemetryEventProperty(event, propertyName + i, propertyValue[i], isPii);
        }
    }
}
