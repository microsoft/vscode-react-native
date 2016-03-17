import * as Q from "q";
import * as child_process from "child_process";
import * as stream from "stream";
import * as events from "events";

import {ISpawnResult, ChildProcess} from "../../common/node/childProcess";

import {IStdOutEvent, IStdErrEvent, IErrorEvent, IExitEvent, ICustomEvent} from "./processExecutionEvents";
import * as processExecutionEvents from "./processExecutionEvents";

export type IEventArguments = processExecutionEvents.IEventArguments;

export interface ISimulationResult {
    simulatedProcess: child_process.ChildProcess;
    simulationEnded: Q.Promise<void>;
}

class FakeStream extends events.EventEmitter {

}

/* We use this class to replay the events that we captured from a real execution of a process, to get
    the best possible simulation of that processes for our tests */
class FakeChildProcess extends events.EventEmitter implements child_process.ChildProcess {
    public stdin:  stream.Writable = <stream.Writable>new FakeStream();
    public stdout: stream.Readable = <stream.Readable>new FakeStream();
    public stderr: stream.Readable = <stream.Readable>new FakeStream();
    public pid: number;

    public kill(signal?: string): void {

    }
    public send(message: any, sendHandle?: any): void {

    }
    public disconnect(): void {

    }
    public unref(): void {

    }
}

export class ProcessExecutionSimulator {
    private process = new FakeChildProcess();

    private allSimulatedEvents: IEventArguments[] = [];

    public spawn(): ISpawnResult {
        const fakeChildProcessModule = <typeof child_process><any>{ spawn: () => {
            return this.process;
        }};

        return new ChildProcess({childProcess: fakeChildProcessModule}).spawnWithExitHandler("", []);
    }

    public simulateAll(events: IEventArguments[]): Q.Promise<void> {
        let simulation = Q.resolve<void>(void 0);

        events.forEach(event => { // Execute one event after the other one
            simulation = simulation.then(() => this.simulate(event));
        });

        return simulation;
    }

    public getAllSimulatedEvents(): IEventArguments[] {
        return this.allSimulatedEvents;
    };

    private simulate(event: IEventArguments): Q.Promise<void> {
        /* TODO: Implement proper timing logic based on return Q.delay(event.at).then(() => {
            using sinon fake timers to simulate time passing */
        return Q.delay(0).then(() => {
            this.allSimulatedEvents.push(event);
            Object.keys(event).forEach(key => {
                if (key !== "after") {
                    switch (key) {
                        case "stdout":
                            this.process.stdout.emit("data", new Buffer((<IStdOutEvent>event).stdout.data));
                            break;
                        case "stderr":
                            this.process.stderr.emit("data", new Buffer((<IStdErrEvent>event).stderr.data));
                            break;
                        case "error":
                            this.process.emit("error", (<IErrorEvent>event).error.error);
                            break;
                        case "exit":
                            this.process.emit("exit", (<IExitEvent>event).exit.code);
                            break;
                        case "custom":
                            (<ICustomEvent>event).custom.lambda();
                            break;
                        default:
                            throw new Error(`Unknown event to simulate: ${key} from:\n\t${event}`);
                    }
                }
            });
        });
    }
}
