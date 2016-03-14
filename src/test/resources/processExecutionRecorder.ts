import * as child_process from "child_process";
import * as events from "events";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";

import {ITimedEvent, IEventArguments} from "./processExecutionEvents";

/* We use this class to capture the behavior of a ChildProces running inside of node, so we can store all the
   visible events and side-effects of that process, and then we can perfectly reproduce them in a test by using
   the ProcessExecutionSimulator class */
export class ProcessExecutionRecorder {
    private events: ITimedEvent[] = [];
    private previousEventTimestamp: number;

    constructor(private processExecution: child_process.ChildProcess, private filePath = ProcessExecutionRecorder.defaultFilePath()) {
    }

    public record(): void {
        this.recordEvent(this.processExecution.stdout, "stdout", "data", "data", data => data.toString());
        this.recordEvent(this.processExecution.stderr, "stderr", "data", "data", data => data.toString());
        this.recordEvent(this.processExecution, "error", "error", "error");
        this.recordEvent(this.processExecution, "exit", "exit", "code");
        this.processExecution.on("error", () =>
            this.store());
        this.processExecution.on("exit", () =>
            this.store());
        this.previousEventTimestamp = this.now();
    }

    private static defaultFilePath(): string {
        return path.join(os.tmpdir(), "processExecutionRecording.txt");
    }

    private now(): number {
        return new Date().getTime();
    }

    private recordEvent(emitter: events.EventEmitter, storedEventName: string, eventToListenName: string,
                        argumentName: string, argumentsConverter: (value: any) => any = value => value): void {
        emitter.on(eventToListenName, (argument: any) => {
            const now = this.now();
            const relativeTimestamp = now - this.previousEventTimestamp;
            this.previousEventTimestamp = now;
            this.events.push(this.generateEvent(relativeTimestamp, storedEventName, argumentName, argumentsConverter(argument)));
        });
    }

    private generateEvent(relativeTimestamp: number, eventName: string, argumentName: string, argument: any): ITimedEvent {
        const event: ITimedEvent = { after: relativeTimestamp };
        (<any>event)[eventName] = this.generateEventArguments(argumentName, argument);
        return event;
    }

    private generateEventArguments(argumentName: string, argument: any): IEventArguments {
        const eventArguments: IEventArguments = <IEventArguments>{};
        (<any>eventArguments)[argumentName] = argument;
        return eventArguments;
    }

    private store(): void {
        fs.appendFileSync(this.filePath, JSON.stringify(this.events) + "\n\n\n", "utf8");
    }
}