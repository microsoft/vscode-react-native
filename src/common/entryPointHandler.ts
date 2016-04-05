// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.

import {ErrorHelper} from "../common/error/errorHelper";
import {ExtensionTelemetryReporter} from "../common/telemetryReporters";
import {InternalError} from "../common/error/internalError";
import {TelemetryHelper} from "../common/telemetryHelper";
import {Telemetry} from "../common/telemetry";
import {Log} from "../common/log/log";
import {ILogger} from "../common/log/loggers";

export enum ProcessType {
    Extension,
    Debugee,
    Debugger
}

/* This class should we used for each entry point of the code, so we handle telemetry and error reporting properly */
export class EntryPointHandler {
    private processType: ProcessType;

    constructor(processType: ProcessType, logger?: ILogger) {
        if (logger) {
            Log.SetGlobalLogger(logger);
        }

        this.processType = processType;
    }

    /* This method should wrap any async entry points to the code, so we handle telemetry and error reporting properly */
    public runFunction(taskName: string, error: InternalError, codeToRun: () => Q.Promise<void> | void, errorsAreFatal: boolean = false): void {
        return this.handleErrors(error, TelemetryHelper.generate(taskName, codeToRun), /*errorsAreFatal*/ errorsAreFatal);
    }

    // This method should wrap the entry point of the whole app, so we handle telemetry and error reporting properly
    public runApp(appName: string, getAppVersion: () => string, error: InternalError, projectRootPathOrReporterToUse: string | Telemetry.ITelemetryReporter,
                  codeToRun: () => Q.Promise<void> | void): void {
        try {
            const appVersion = getAppVersion();
            const reporterToUse = typeof projectRootPathOrReporterToUse !== "string" ? <Telemetry.ITelemetryReporter>projectRootPathOrReporterToUse : null;
            const reporter = reporterToUse || (this.processType === ProcessType.Extension
                ? Telemetry.defaultTelemetryReporter(appVersion)
                : new ExtensionTelemetryReporter(Telemetry.appName, appVersion, Telemetry.APPINSIGHTS_INSTRUMENTATIONKEY, <string>projectRootPathOrReporterToUse));
            Telemetry.init(appName, appVersion, reporter);
            return this.runFunction(appName, error, codeToRun, true);
        } catch (error) {
            Log.logError(error, false);
            throw error;
        }
    }

    private handleErrors(error: InternalError, resultOfCode: Q.Promise<void>, errorsAreFatal: boolean): void {
        resultOfCode.done(() => { }, reason => {
            const isDebugeeProcess = this.processType === ProcessType.Debugee;
            const shouldLogStack = !errorsAreFatal || isDebugeeProcess;
            Log.logError(ErrorHelper.wrapError(error, reason), /*logStack*/ shouldLogStack);
            // For the debugee process we don't want to throw an exception because the debugger
            // will appear to the user if he turned on the VS Code uncaught exceptions feature.
            if (errorsAreFatal) {
                if (isDebugeeProcess) {
                    process.exit(1);
                } else {
                    throw reason;
                }
            }
        });
    }
}