// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.

import * as stream from "stream";
import * as events from "events";
import * as child_process from "child_process";

class Stream extends events.EventEmitter {
    // The methods we get from events.EventEmitter seems to be enough for what we need
}

/* ChildProcess can emit events to simulate the behavior of a real child process from the
   spawneer/caller point of view */
export class ChildProcess extends events.EventEmitter implements child_process.ChildProcess {
    public stdin: stream.Writable = <stream.Writable>new Stream();
    public stdout: stream.Readable = <stream.Readable>new Stream();
    public stderr: stream.Readable = <stream.Readable>new Stream();
    public pid: number; // Not yet implemented
    public connected: boolean;
    public stdio: [stream.Writable, stream.Readable, stream.Readable]; // Not yet implemented
    public killed: boolean;

    public kill(signal?: string): void {
        this.notYetImplemented();
    }

    public send(message: any, sendHandle?: any): boolean {
        this.notYetImplemented();
        return false;
    }

    public disconnect(): void {
        this.notYetImplemented();
    }

    public unref(): void {
        this.notYetImplemented();
    }

    public ref(): void {
        this.notYetImplemented();
    }

    private notYetImplemented(): void {
        // We'll implement these methods if we ever need them
        throw new Error("This method of class ChildProcess has not yet been implemented.");
    }
}
