// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.

// These typings do not reflect the typings as intended to be used
// but rather as they exist in truth, so we can reach into the internals
// and access what we need.
declare module VSCodeDebugAdapter {
    class DebugSession {
        public static run: Function;
        public sendEvent(event: VSCodeDebugAdapter.InitializedEvent): void;
        public start(input: any, output: any): void;
        public launchRequest(response: any, args: any): void;
        public attachRequest(response: any, args: any): void;
        public disconnectRequest(response: any, args: any): void;
    }
    class InitializedEvent {
        constructor();
    }
    class OutputEvent {
        constructor(message: string, destination?: string);
    }
    class TerminatedEvent {
        constructor();
    }
}

declare class SourceMaps {
    public _sourceToGeneratedMaps: {};
    public _generatedToSourceMaps: {};
    public _allSourceMaps: {};
}

declare class NodeDebugSession extends VSCodeDebugAdapter.DebugSession {
    public _sourceMaps: SourceMaps;
}

interface ILaunchRequestArgs {
    platform: string;
    target?: string;
    internalDebuggerPort?: any;
    iosRelativeProjectPath?: string;
    args: string[];
    logCatArguments: any;
    program: string;
}

interface IAttachRequestArgs {
    args: string[];
}