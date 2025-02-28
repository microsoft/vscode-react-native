// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.

import * as events from "events";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import { quote } from "shell-quote";
import child_process = require("child_process");

import {
    ITimedEvent,
    IEventArguments,
    Recording,
    IAndroidDevice,
    IIOSDevice,
    ISpawnArguments,
    ISpawnOptions,
} from "./recording";

/* We use this class to capture the behavior of a ChildProces running inside of node, so we can store all the
   visible events and side-effects of that process, and then we can perfectly reproduce them in a test by using
   the Simulator class.

   Call Recorder.installGlobalRecorder() when your program starts to record the events of all the spawned processes.
   The recordings will be stored at the OS temporary directory e.g.:
        Windows: %TEMP%\processExecutionRecording.txt
        OS X: $TMPDIR/processExecutionRecording.txt
*/
export class Recorder {
    private static originalSpawn: (
        command: string,
        args: string[],
        options: ISpawnOptions,
    ) => child_process.ChildProcess;

    private recording: Recording;
    private previousEventTimestamp: number;

    public static installGlobalRecorder(): void {
        if (!this.originalSpawn) {
            this.originalSpawn = child_process.spawn;
            child_process.spawn = this.recordAndSpawn.bind(this);
        }
    }

    public static recordAndSpawn(
        command: string,
        args: string[] = [],
        options: ISpawnOptions = {},
    ): child_process.ChildProcess {
        const spawnedProcess = this.originalSpawn(command, [quote(args)], options);
        new Recorder(spawnedProcess, { command, args, options }).record();
        return spawnedProcess;
    }

    constructor(
        private execution: child_process.ChildProcess,
        spawnArguments: ISpawnArguments,
        private filePath = Recorder.defaultFilePath(),
    ) {
        this.initializeRecording(spawnArguments);
    }

    public record(): void {
        this.addListenerForRecordingEvent(this.execution.stdout, "stdout", "data", "data", data =>
            data.toString(),
        );
        this.addListenerForRecordingEvent(this.execution.stderr, "stderr", "data", "data", data =>
            data.toString(),
        );
        this.addListenerForRecordingEvent(this.execution, "error", "error", "error");
        this.addListenerForRecordingEvent(this.execution, "exit", "exit", "code");
        this.execution.on("error", () => this.store());
        this.execution.on("exit", () => this.store());
        this.previousEventTimestamp = this.now();
    }

    private initializeRecording(spawnArguments: ISpawnArguments): void {
        /* The TBD values needs to be filled manually by the recorder, so we know the full context
           where this recording was made */
        this.recording = {
            title: "TBD",
            arguments: spawnArguments,
            date: new Date(),
            configuration: {
                os: { platform: os.platform(), release: os.release() },
                android: {
                    sdk: {
                        tools: "TBD",
                        platformTools: "TBD",
                        buildTools: "TBD",
                        repositoryForSupportLibraries: "TBD",
                    },
                    intelHAXMEmulator: "TBD",
                    visualStudioEmulator: "TBD",
                },
                reactNative: "TBD",
                node: "TBD",
                npm: "TBD",
            },
            state: {
                reactNative: { packager: "TBD" },
                devices: { android: <IAndroidDevice[]>[], ios: <IIOSDevice[]>[] },
            },
            events: <IEventArguments[]>[],
        };
    }

    private static defaultFilePath(): string {
        return path.join(os.tmpdir(), "processExecutionRecording.txt");
    }

    private now(): number {
        return new Date().getTime();
    }

    private addListenerForRecordingEvent(
        emitter: events.EventEmitter,
        storedEventName: string,
        eventToListenName: string,
        argumentName: string,
        argumentsConverter: (value: any) => any = value => value,
    ): void {
        emitter.on(eventToListenName, (argument: any) => {
            const now = this.now();
            const relativeTimestamp = now - this.previousEventTimestamp;
            this.previousEventTimestamp = now;
            this.recording.events.push(
                this.generateEvent(
                    relativeTimestamp,
                    storedEventName,
                    argumentName,
                    argumentsConverter(argument),
                ),
            );
        });
    }

    /* Generate an event based on the parameters e.g.: { "after": 0, "stdout": { "data": ":app:assembleDebug" } } */
    private generateEvent(
        relativeTimestamp: number,
        eventName: string,
        argumentName: string,
        argument: any,
    ): IEventArguments {
        const event: ITimedEvent = { after: relativeTimestamp };
        (<any>event)[eventName] = this.generateEventArguments(argumentName, argument);
        return <IEventArguments>event;
    }

    /* Generate the event arguments based on the parameters e.g.: { "data": ":app:assembleDebug" } */
    private generateEventArguments(argumentName: string, argument: any): IEventArguments {
        const eventArguments: IEventArguments = <IEventArguments>{};
        (<any>eventArguments)[argumentName] = argument;
        return eventArguments;
    }

    private store(): void {
        fs.appendFileSync(this.filePath, JSON.stringify(this.recording) + "\n\n\n", "utf8");
    }
}
