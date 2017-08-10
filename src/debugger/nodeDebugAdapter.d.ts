// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.

// These typings do not reflect the typings as intended to be used
// but rather as they exist in truth, so we can reach into the internals
// and access what we need.
declare module VSCodeDebugAdapterPackage {

    class Event {
        public event: string;
        public body: any;
    }

    class DebugSession {
        public static run(debugSession: typeof DebugSession): void;
        // This is actually inherited from protocol server but we'll put it here
        public start(inStream: NodeJS.ReadableStream, outStream: NodeJS.WritableStream): void;
        public sendEvent(event: Event): void;
    }
    class InitializedEvent extends Event {
        constructor();
    }
    class OutputEvent extends Event {
        constructor(message: string, destination?: string);
    }
    class TerminatedEvent extends Event {
        constructor();
    }

    class ContinuedEvent extends Event {
        public seq: number;
        /** Must be 'event'. */
        public type: string;
        public body: {
            threadId: number;
        };
    }
    interface Request {
        command: string;
        arguments?: any;
    }
}

declare module ChromeDebuggerCorePackage {
    abstract class ChromeDebugAdapter {
        protected _attachMode: boolean;
        protected doAttach(port: number, targetUrl?: string, address?: string, timeout?: number): Promise<void>;
    }

    interface IChromeDebugSessionOpts {
        logFilePath?: string;
        adapter: typeof ChromeDebugAdapter;
        extensionName: string;
    }

    class ChromeDebugSession extends VSCodeDebugAdapterPackage.DebugSession {
        protected _debugAdapter: any;
        constructor(debuggerLinesAndColumnsStartAt1?: boolean, isServer?: boolean, opts?: IChromeDebugSessionOpts);
        protected dispatchRequest(request: { command: string }): void;
    }
}

declare module Node2DebugAdapterPackage {

    type ChecksumAlgorithm = "MD5" | "SHA1" | "SHA256" | "timestamp";

    interface Checksum {
        algorithm: ChecksumAlgorithm;
        checksum: string;
    }

    interface Source {
        name?: string;
        path?: string;
        sourceReference?: number;
        presentationHint?: "emphasize" | "deemphasize";
        origin?: string;
        adapterData?: any;
        checksums?: Checksum[];
    }

    interface Breakpoint {
        id?: number;
        verified: boolean;
        message?: string;
        source?: Source;
        line?: number;
        column?: number;
        endLine?: number;
        endColumn?: number;
    }

    interface ISetBreakpointsResponseBody {
        breakpoints: Breakpoint[];
    }

    class Node2DebugAdapter extends ChromeDebuggerCorePackage.ChromeDebugAdapter {
        protected doAttach(port: number, targetUrl?: string, address?: string, timeout?: number): Promise<void>;
        public setBreakpoints(args: any, requestSeq: number, ids?: number[]): Promise<ISetBreakpointsResponseBody>;
    }
}

