// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.

import {TelemetryHelper} from "../common/TelemetryHelper";
import {Telemetry} from "../common/Telemetry";
import {Log} from "../common/Log";
import {OutputChannel} from "vscode";

/* This class should we used for each entry point of the code, so we handle telemetry and error reporting properly */
export class EntryPoint {
    private outputChannel: OutputChannel;

    constructor(outputChannel?: OutputChannel) {
        this.outputChannel = outputChannel;
    }

    /* This method should wrap any async entry points to the code, so we handle telemetry and error reporting properly */
    public runCode(taskName: string, errorDescription: string, codeToRun: () => Q.Promise<void>, areErrorsFatal: boolean): void {
        return this.handleErrors(errorDescription, TelemetryHelper.generate(taskName, codeToRun), /*areErrorsFatal*/ areErrorsFatal);
    }

    /* This method should wrap any 100% sync entry points to the code, so we handle telemetry and error reporting properly */
    public runSyncCode(taskName: string, errorDescription: string, codeToRun: () => void): void {
        try {
            TelemetryHelper.sendSimpleEvent(taskName + ".starting"); // We call sendSimpleEvent because generate is async only
            codeToRun();
            TelemetryHelper.sendSimpleEvent(taskName + ".succesfull");
        } catch (error) {
            Log.logError(errorDescription, error, this.outputChannel, /*logStack*/ true);
            TelemetryHelper.sendSimpleEvent(taskName + ".failed");
        }
    }

    /* This method should wrap the entry point of the whole app, so we handle telemetry and error reporting properly */
    public runApp(appName: string, getAppVersion: () => string, errorDescription: string, codeToRun: () => Q.Promise<void>): void {
        const telemetryErrorDescription = `${errorDescription}. Couldn't initialize telemetry`;
        try { // try-catch for sync errors in init telemetry
            return this.handleErrors(telemetryErrorDescription, // handleErrors for async errors in init telemetry
                Telemetry.init("react-native", getAppVersion(), true).then(() =>
                // After telemetry is initialized, we run the code. Errors in this main path are fatal so we rethrow them
                    this.runCode(appName, errorDescription, codeToRun, /*areErrorsFatal*/ true)), /*areErrorsFatal*/ true);
        } catch (error) {
            Log.logError(telemetryErrorDescription, error, this.outputChannel, /*logStack*/ false); // Print the error and re-throw the exception
            throw error;
        }
    }

    private handleErrors(errorDescription: string, codeToRun: Q.Promise<void>, areErrorsFatal: boolean): void {
        codeToRun.done(() => { }, reason => {
            Log.logError(errorDescription, reason, this.outputChannel, /*logStack*/ !areErrorsFatal);
            if (areErrorsFatal) {
              throw reason;
            }
        });
    }
}