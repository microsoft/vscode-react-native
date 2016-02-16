/**
 *******************************************************
 *                                                     *
 *   Copyright (C) Microsoft. All rights reserved.     *
 *                                                     *
 *******************************************************
 */

import * as fs from 'fs';
import * as path from 'path';
import * as Q from 'q';
import {Telemetry} from './telemetry';

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

interface IDictionary<T> {
    [key: string]: T;
}

interface IHasErrorCode {
    errorCode: number;
}

export abstract class TelemetryGeneratorBase {
    protected telemetryProperties: ICommandTelemetryProperties = {};
    private componentName: string;
    private currentStepStartTime: number[];
    private currentStep: string = 'initialStep';
    private errorIndex: number = -1; // In case we have more than one error (We start at -1 because we increment it before using it)

    constructor(componentName: string) {
        this.componentName = componentName;
        this.currentStepStartTime = process.hrtime();
    }

    protected abstract sendTelemetryEvent(telemetryEvent: Telemetry.TelemetryEvent): void;

    public add(baseName: string, value: any, isPii: boolean): TelemetryGeneratorBase {
        return this.addWithPiiEvaluator(baseName, value, () => isPii);
    }

    public addWithPiiEvaluator(baseName: string, value: any, piiEvaluator: { (value: string, name: string): boolean }): TelemetryGeneratorBase {
        // We have 3 cases:
        //     * Object is an array, we add each element as baseNameNNN
        //     * Object is a hash, we add each element as baseName.KEY
        //     * Object is a value, we add the element as baseName
        try {
            if (Array.isArray(value)) {
                this.addArray(baseName, <any[]> value, piiEvaluator);
            } else if (!!value && (typeof value === 'object' || typeof value === 'function')) {
                this.addHash(baseName, <IDictionary<any>> value, piiEvaluator);
            } else {
                this.addString(baseName, String(value), piiEvaluator);
            }
        } catch (error) {
            // We don't want to crash the functionality if the telemetry fails.
            // This error message will be a javascript error message, so it's not pii
            this.addString('telemetryGenerationError.' + baseName, String(error), () => false);
        }

        return this;
    }

    public addError(error: Error): TelemetryGeneratorBase {
        this.add('error.message' + ++this.errorIndex, error.message, /*isPii*/ true);
        var errorWithErrorCode: IHasErrorCode = <IHasErrorCode> <Object> error;
        if (errorWithErrorCode.errorCode) {
            this.add('error.code' + this.errorIndex, errorWithErrorCode.errorCode, /*isPii*/ false);
        }

        return this;
    }

    public time<T>(name: string, codeToMeasure: { (): Thenable<T> }): Q.Promise<T> {
        var startTime: number[] = process.hrtime();
        return Q(codeToMeasure()).finally(() => this.finishTime(name, startTime)).fail((reason: any): Q.Promise<T> => {
            this.addError(reason);
            throw reason;
            return null;
        });
    }

    public step(name: string): TelemetryGeneratorBase {
        // First we finish measuring this step time, and we send a telemetry event for this step
        this.finishTime(this.currentStep, this.currentStepStartTime);
        this.sendCurrentStep();

        // Then we prepare to start gathering information about the next step
        this.currentStep = name;
        this.telemetryProperties = {};
        this.currentStepStartTime = process.hrtime();
        return this;
    }

    public send(): void {
        if (this.currentStep) {
            this.add('lastStepExecuted', this.currentStep, /*isPii*/ false);
        }

        this.step(null); // Send the last step
    }

    private sendCurrentStep(): void {
        this.add('step', this.currentStep, /*isPii*/ false);
        var telemetryEvent: Telemetry.TelemetryEvent = new Telemetry.TelemetryEvent(Telemetry.appName + '/' + this.componentName);
        TelemetryHelper.addTelemetryEventProperties(telemetryEvent, this.telemetryProperties);
        this.sendTelemetryEvent(telemetryEvent);
    }

    private addArray(baseName: string, array: any[], piiEvaluator: { (value: string, name: string): boolean }): void {
        // Object is an array, we add each element as baseNameNNN
        var elementIndex: number = 1; // We send telemetry properties in a one-based index
        array.forEach((element: any) => this.addWithPiiEvaluator(baseName + elementIndex++, element, piiEvaluator));
    }

    private addHash(baseName: string, hash: IDictionary<any>, piiEvaluator: { (value: string, name: string): boolean }): void {
        // Object is a hash, we add each element as baseName.KEY
        Object.keys(hash).forEach((key: string) => this.addWithPiiEvaluator(baseName + '.' + key, hash[key], piiEvaluator));
    }

    private addString(name: string, value: string, piiEvaluator: { (value: string, name: string): boolean }): void {
        this.telemetryProperties[name] = TelemetryHelper.telemetryProperty(value, piiEvaluator(value, name));
    }

    private combine(...components: string[]): string {
        var nonNullComponents: string[] = components.filter((component: string) => component !== null);
        return nonNullComponents.join('.');
    }

    private finishTime(name: string, startTime: number[]): void {
        var endTime: number[] = process.hrtime(startTime);
        this.add(this.combine(name, 'time'), String(endTime[0] * 1000 + endTime[1] / 1000000), /*isPii*/ false);
    }
}

export class TelemetryGenerator extends TelemetryGeneratorBase {
    protected sendTelemetryEvent(telemetryEvent: Telemetry.TelemetryEvent): void {
        Telemetry.send(telemetryEvent);
    }
}

export class TelemetryHelper {
    public static createTelemetryEvent(eventName: string): Telemetry.TelemetryEvent {
        return new Telemetry.TelemetryEvent(Telemetry.appName + '/' + eventName);
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

    public static sendCommandSuccessTelemetry(commandName: string, commandProperties: ICommandTelemetryProperties, args: string[] = null): void {
        var successEvent: Telemetry.TelemetryEvent = TelemetryHelper.createBasicCommandTelemetry(commandName, args);

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

    public static addPropertiesFromOptions(telemetryProperties: ICommandTelemetryProperties, knownOptions: any,
        commandOptions: { [flag: string]: any }, nonPiiOptions: string[] = []): ICommandTelemetryProperties {
        // We parse only the known options, to avoid potential private information that may appear on the command line
        var unknownOptionIndex: number = 1;
        Object.keys(commandOptions).forEach((key: string) => {
            var value: any = commandOptions[key];
            if (Object.keys(knownOptions).indexOf(key) >= 0) {
                // This is a known option. We'll check the list to decide if it's pii or not
                if (typeof (value) !== 'undefined') {
                    // We encrypt all options values unless they are specifically marked as nonPii
                    telemetryProperties['options.' + key] = this.telemetryProperty(value, nonPiiOptions.indexOf(key) < 0);
                }
            } else {
                // This is a not known option. We'll assume that both the option and the value are pii
                telemetryProperties['unknownOption' + unknownOptionIndex + '.name'] = this.telemetryProperty(key, /*isPii*/ true);
                telemetryProperties['unknownOption' + unknownOptionIndex++ + '.value'] = this.telemetryProperty(value, /*isPii*/ true);
            }
        });
        return telemetryProperties;
    }

    public static generate<T>(name: string, codeGeneratingTelemetry: { (telemetry: TelemetryGenerator): Thenable<T> }): Q.Promise<T> {
        var generator: TelemetryGenerator = new TelemetryGenerator(name);
        return generator.time(null, () => codeGeneratingTelemetry(generator)).finally(() => generator.send());
    }

    private static addTelemetryProperties(telemetryProperties: ICommandTelemetryProperties, newProps: Telemetry.ITelemetryProperties): void {
        Object.keys(newProps).forEach(function (propName: string): void {
            telemetryProperties[propName] = TelemetryHelper.telemetryProperty(newProps[propName]);
        });
    }

    private static createBasicCommandTelemetry(commandName: string, args: string[] = null): Telemetry.TelemetryEvent {
        var commandEvent: Telemetry.TelemetryEvent = new Telemetry.TelemetryEvent(Telemetry.appName + '/' + (commandName || 'command'));

        if (!commandName && args && args.length > 0) {
            commandEvent.setPiiProperty('command', args[0]);
        }

        if (args) {
            TelemetryHelper.addTelemetryEventProperty(commandEvent, 'argument', args, true);
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

    private static addMultiValuedTelemetryEventProperty(event: Telemetry.TelemetryEvent, propertyName: string, propertyValue: string, isPii: boolean): void {
        for (var i: number = 0; i < propertyValue.length; i++) {
            TelemetryHelper.setTelemetryEventProperty(event, propertyName + i, propertyValue[i], isPii);
        }
    }
};