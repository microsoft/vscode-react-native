// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.

import * as assert from "assert";
import * as child_process from "child_process";

import { ISpawnResult, ChildProcess } from "../../../src/common/node/childProcess";
import { PromiseUtil } from "../../../src/common/node/promise";

import { IStdOutEvent, IStdErrEvent, IErrorEvent, IExitEvent, ICustomEvent } from "./recording";
import * as recording from "./recording";
import * as simulators from "../simulators/childProcess";

export type IEventArguments = recording.IEventArguments;
export type Recording = recording.Recording;

export interface ISimulationResult {
    simulatedProcess: child_process.ChildProcess;
    simulationEnded: Promise<void> | void;
}

/* The side effects definition has rule to identify when an event with side effects happened in the simulation,
   and the callback that must be called for the simulator to simulate that side-effect during the tests.
   e.g.: When the 'projectWasCreated' event happens, we call a callback to actually create the project */
export interface ISideEffectsDefinition {
    beforeStart: () => Promise<void>;
    outputBased: IOutputBasedSideEffectDefinition[];
    beforeSuccess: (stdout: string, stderr: string) => Promise<void>;
}

type IOutputBasedSideEffectDefinition =
    | IOutputSingleEventBasedSideEffectDefinition
    | IWholeOutputBasedSideEffectDefinition;

// Side effects based on analyzing each stdout event individually
export interface IOutputSingleEventBasedSideEffectDefinition {
    eventPattern: RegExp;
    action: () => Promise<void>;
}

// Side effects based on analyzing the whole stdout of the recording
export interface IWholeOutputBasedSideEffectDefinition {
    wholeOutputPattern: RegExp;
    action: () => Promise<void>;
}

/* We use this class to replay the events that we captured from a real execution of a process, to get
    the best possible simulation of that processes for our tests */
export class Simulator {
    private process = new simulators.ChildProcess(); // Fake child process where we'll simulate the events that are recorded

    private wholeOutputBasedDefinitions: IWholeOutputBasedSideEffectDefinition[];
    private outputEventBasedDefinitions: IOutputSingleEventBasedSideEffectDefinition[];

    private allSimulatedEvents: IEventArguments[] = [];

    private allStdout = ""; // All the stdout the recordings have generated so far
    private allStderr = ""; // All the stderr the recordings have generated so far

    constructor(private sideEffectsDefinition: ISideEffectsDefinition) {
        // We extract the whole output rules and the single event output rules into two different lists.
        this.outputEventBasedDefinitions = <IOutputSingleEventBasedSideEffectDefinition[]>(
            this.sideEffectsDefinition.outputBased.filter(
                definition => !this.isWholeOutputDefinition(definition),
            )
        );
        this.wholeOutputBasedDefinitions = <IWholeOutputBasedSideEffectDefinition[]>(
            this.sideEffectsDefinition.outputBased.filter(definition =>
                this.isWholeOutputDefinition(definition),
            )
        );
    }

    /* Given that we use ChildProcess for spawning processes, we create this spawn method with a
       similar result, so it'll be easier for simulated/fake classes to behave similar to the real
       ChildProcess class when spawning a simulated process */
    public spawn(): ISpawnResult {
        const fakeChildProcessModule = <typeof child_process>(<any>{
            spawn: () => {
                return this.process;
            },
        });

        /* We call spawn to fill the ISpawnResult object appropiatedly. The command
           and the arguments don't affect that object, so we just pass an empty command and parameters */
        return new ChildProcess({ childProcess: fakeChildProcessModule }).spawn("", []);
    }

    public simulate(simRecording: Recording): Promise<void> {
        assert(simRecording, "recording shouldn't be null");
        return this.sideEffectsDefinition.beforeStart().then(() => {
            return this.simulateAllEvents(simRecording.events);
        });
    }

    public simulateAllEvents(events: IEventArguments[]): Promise<void> {
        return PromiseUtil.reduce(events, (event: IEventArguments) =>
            this.simulateSingleEvent(event),
        );
    }

    public getAllSimulatedEvents(): IEventArguments[] {
        return this.allSimulatedEvents;
    }

    private isWholeOutputDefinition(definition: IOutputBasedSideEffectDefinition): boolean {
        return definition.hasOwnProperty("wholeOutputPattern");
    }

    private simulateOutputSideEffects(data: string, previousOutputLength: number): Promise<void> {
        /* We store the applicable side effects with the index where they were applicable, so we execute the
           ones that were detected earlier in the recording first */
        const applicableSideEffectDefinitions: {
            index: number;
            definition: IOutputBasedSideEffectDefinition;
        }[] = [];

        this.outputEventBasedDefinitions.forEach(definition => {
            const match = data.match(definition.eventPattern);
            if (match && match.index !== undefined) {
                applicableSideEffectDefinitions.push({
                    index: previousOutputLength + match.index, // Index relative to the whole output
                    definition: definition,
                });
            }
        });

        /* We add the elements that match the whole output to applicableSideEffectDefinitions, and we remove them
            from future iterations of wholeOutputBasedDefinitions so they won't be matched again. */
        this.wholeOutputBasedDefinitions = this.wholeOutputBasedDefinitions.filter(definition => {
            const match = this.allStdout.match(definition.wholeOutputPattern);
            if (match && match.index !== undefined) {
                applicableSideEffectDefinitions.push({
                    index: match.index,
                    definition: definition,
                });
                return false; // We've just matched the output. Remove it from future iterations of wholeOutputBasedDefinitions
            }

            return true; // We didn't match yet, keep it for future iterations of wholeOutputBasedDefinitions
        });

        // Sort by index, so the action matching the earlier text gets executed first
        applicableSideEffectDefinitions.sort((a, b) => a.index - b.index);

        return PromiseUtil.reduce(applicableSideEffectDefinitions, definition =>
            definition.definition.action(),
        );
    }

    private simulateSingleEvent(event: IEventArguments): Promise<void> {
        /* TODO: Implement proper timing logic based on return Q.delay(event.at).then(() => {
            using sinon fake timers to simulate time passing by */
        return new Promise(resolve => {
            this.allSimulatedEvents.push(event);
            const key = Object.keys(event).find(eventKey => eventKey !== "after"); // At the moment we are only using a single key/parameter per event
            switch (key) {
                case "stdout": {
                    const data = (<IStdOutEvent>event).stdout.data;
                    const previousOutputLength = this.allStdout.length;
                    this.allStdout += data;
                    this.simulateOutputSideEffects(data, previousOutputLength).then(() => {
                        this.process.stdout.emit("data", Buffer.from(data));
                    });
                    break;
                }
                case "stderr": {
                    const data = (<IStdErrEvent>event).stderr.data;
                    this.allStderr += data;
                    this.process.stderr.emit("data", Buffer.from(data));
                    break;
                }
                case "error":
                    this.process.emit("error", (<IErrorEvent>event).error.error);
                    break;
                case "exit":
                    const code = (<IExitEvent>event).exit.code;

                    let beforeFinishing = Promise.resolve();
                    if (code === 0) {
                        beforeFinishing = Promise.resolve(
                            this.sideEffectsDefinition.beforeSuccess(
                                this.allStdout,
                                this.allStderr,
                            ),
                        );
                    }

                    beforeFinishing.then(() => {
                        this.process.emit("exit", code);
                    });
                    break;
                case "custom":
                    return (<ICustomEvent>event).custom.lambda();
                default:
                    throw new Error(`Unknown event to simulate: ${key} from:\n\t${event}`);
            }
            return resolve();
        });
    }
}
