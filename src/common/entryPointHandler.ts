// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.

import {ErrorHelper} from "./error/errorHelper";
import {InternalError} from "./error/internalError";
import {TelemetryHelper, ICommandTelemetryProperties} from "./telemetryHelper";
import {TelemetryGenerator} from "./telemetryGenerators";
import {Telemetry} from "./telemetry";
import {ConsoleLogger} from "../extension/log/ConsoleLogger";
import {ILogger} from "../extension/log/LogHelper";

export enum ProcessType {
    Extension,
    Debugee,
    Debugger,
}

/* This class should we used for each entry point of the code, so we handle telemetry and error reporting properly */
export class EntryPointHandler {
    private processType: ProcessType;

    constructor(processType: ProcessType, private logger: ILogger = new ConsoleLogger()) {

        this.processType = processType;
    }

    /* This method should wrap any async entry points to the code, so we handle telemetry and error reporting properly */
    public runFunction(taskName: string, error: InternalError, codeToRun: (telemetry: TelemetryGenerator) => Promise<void> | void, errorsAreFatal: boolean = false, extProps?: ICommandTelemetryProperties): Promise<void> {
        return this.runFunctionWExtProps(taskName, extProps || {}, error, codeToRun, errorsAreFatal);
    }

    public runFunctionWExtProps(taskName: string, extProps: ICommandTelemetryProperties, error: InternalError, codeToRun: (telemetry: TelemetryGenerator) => Promise<void> | void, errorsAreFatal: boolean = false): Promise<void> {
        return this.handleErrors(error, TelemetryHelper.generate(taskName, extProps, codeToRun), /*errorsAreFatal*/ errorsAreFatal);
    }

    // This method should wrap the entry point of the whole app, so we handle telemetry and error reporting properly
    public runApp(appName: string, appVersion: string, error: InternalError, reporter: Telemetry.ITelemetryReporter, codeToRun: () => Promise<void> | void, extProps?: ICommandTelemetryProperties): Promise<void>  {
        try {
            Telemetry.init(appName, appVersion, reporter);
            return this.runFunction(appName, error, codeToRun, true, extProps);
        } catch (error) {
            this.logger.error(error);
            throw error;
        }
    }

    private handleErrors(error: InternalError, resultOfCode: Promise<void>, errorsAreFatal: boolean): Promise<void> {
        resultOfCode.catch(reason => {
            const isDebugeeProcess = this.processType === ProcessType.Debugee;
            const shouldLogStack = !errorsAreFatal || isDebugeeProcess;
            this.logger.error(error.message, ErrorHelper.wrapError(error, reason), shouldLogStack);
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

        return resultOfCode;
    }
}
