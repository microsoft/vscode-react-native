/* Event types used by the ProcessExecutionRecorder and ProcessExecutionSimulator */

export interface ITimedEvent {
    after: number;
}

export interface IStdOutEvent extends ITimedEvent {
    stdout: { data: string };
}

export interface IStdErrEvent extends ITimedEvent {
    stderr: { data: string };
}

export interface IErrorEvent extends ITimedEvent {
    error: { error: any };
}

export interface IExitEvent extends ITimedEvent {
    exit: { code: number };
}

export interface ICustomEvent extends ITimedEvent {
    custom: { lambda: () => Q.Promise<void> | void };
}

export type IEventArguments = IStdOutEvent | IStdErrEvent | IErrorEvent | IExitEvent | ICustomEvent;
