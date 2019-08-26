// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.

import * as Q from "q";
import { Telemetry } from "./telemetry";
import { ICommandTelemetryProperties, TelemetryHelper } from "./telemetryHelper";

interface IDictionary<T> {
    [key: string]: T;
}

export interface IHasErrorCode {
    errorCode: number;
}

export abstract class TelemetryGeneratorBase {
    protected telemetryProperties: ICommandTelemetryProperties = {};
    private componentName: string;
    private currentStepStartTime: [number, number];
    private currentStep: string = "initialStep";
    private errorIndex: number = -1; // In case we have more than one error (We start at -1 because we increment it before using it)
    private extendedTelemetryProperties: ICommandTelemetryProperties = {};

    constructor(componentName: string, extendedProps: ICommandTelemetryProperties = {}) {
        this.componentName = componentName;
        this.extendedTelemetryProperties = extendedProps;
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
            } else if (!!value && (typeof value === "object" || typeof value === "function")) {
                this.addHash(baseName, <IDictionary<any>> value, piiEvaluator);
            } else {
                this.addString(baseName, String(value), piiEvaluator);
            }
        } catch (error) {
            // We don"t want to crash the functionality if the telemetry fails.
            // This error message will be a javascript error message, so it"s not pii
            this.addString("telemetryGenerationError." + baseName, String(error), () => false);
        }

        return this;
    }

    public addError(error: Error): TelemetryGeneratorBase {
        this.add("error.message" + ++this.errorIndex, error.message, /*isPii*/ true);
        let errorWithErrorCode: IHasErrorCode = <IHasErrorCode> <Object> error;
        if (errorWithErrorCode.errorCode) {
            this.add("error.code" + this.errorIndex, errorWithErrorCode.errorCode, /*isPii*/ false);
        }

        return this;
    }

    public time<T>(name: string, codeToMeasure: { (): Q.Promise<T>|T }): Q.Promise<T> {
        let startTime: [number, number] = process.hrtime();
        return Q(codeToMeasure())
        .finally(() => this.finishTime(name, startTime))
        .fail((reason: any): Q.Promise<T> => {
            this.addError(reason);
            return Q.reject<T>(reason);
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
            this.add("lastStepExecuted", this.currentStep, /*isPii*/ false);
        }

        this.step(""); // Send the last step
    }

    private sendCurrentStep(): void {
        this.add("step", this.currentStep, /*isPii*/ false);
        let telemetryEvent: Telemetry.TelemetryEvent = new Telemetry.TelemetryEvent(this.componentName);
        TelemetryHelper.addTelemetryEventProperties(telemetryEvent, Object.assign(this.telemetryProperties, this.extendedTelemetryProperties));
        this.sendTelemetryEvent(telemetryEvent);
    }

    private addArray(baseName: string, array: any[], piiEvaluator: { (value: string, name: string): boolean }): void {
        // Object is an array, we add each element as baseNameNNN
        let elementIndex: number = 1; // We send telemetry properties in a one-based index
        array.forEach((element: any) => this.addWithPiiEvaluator(baseName + elementIndex++, element, piiEvaluator));
    }

    private addHash(baseName: string, hash: IDictionary<any>, piiEvaluator: { (value: string, name: string): boolean }): void {
        // Object is a hash, we add each element as baseName.KEY
        Object.keys(hash).forEach((key: string) => this.addWithPiiEvaluator(baseName + "." + key, hash[key], piiEvaluator));
    }

    private addString(name: string, value: string, piiEvaluator: { (value: string, name: string): boolean }): void {
        this.telemetryProperties[name] = TelemetryHelper.telemetryProperty(value, piiEvaluator(value, name));
    }

    private combine(...components: string[]): string {
        let nonNullComponents: string[] = components.filter((component: string) => !!component);
        return nonNullComponents.join(".");
    }

    private finishTime(name: string, startTime: [number, number]): void {
        if (!!name) { // not a ghost step
            let endTime: [number, number] = process.hrtime(startTime);
            this.add(this.combine(name, "time"), String(endTime[0] * 1000 + endTime[1] / 1000000), /*isPii*/ false);
        }
    }
}

export class TelemetryGenerator extends TelemetryGeneratorBase {
    protected sendTelemetryEvent(telemetryEvent: Telemetry.TelemetryEvent): void {
        Telemetry.send(telemetryEvent);
    }
}
