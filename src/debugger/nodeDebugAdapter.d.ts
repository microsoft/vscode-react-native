// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.

// These typings do not reflect the typings as intended to be used
// but rather as they exist in truth, so we can reach into the internals
// and access what we need.
declare module VSCodeDebugAdapterPackage {
    class DebugSession {
        public static run(debugSession: typeof DebugSession): void;
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
    class Event {
        public event: string;
        public body: any;
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
        public sendEvent(event: VSCodeDebugAdapterPackage.InitializedEvent): void;
        protected dispatchRequest(request: { command: string }): void;
    }
}

declare module Node2DebugAdapterPackage {
    class Node2DebugAdapter extends ChromeDebuggerCorePackage.ChromeDebugAdapter {
        protected doAttach(port: number, targetUrl?: string, address?: string, timeout?: number): Promise<void>;
    }
}

