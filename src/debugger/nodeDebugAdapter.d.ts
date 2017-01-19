// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.

// These typings do not reflect the typings as intended to be used
// but rather as they exist in truth, so we can reach into the internals
// and access what we need.
declare module VSCodeDebugAdapterPackage {
    class DebugSession {
        public static run: Function;
        public sendEvent(event: VSCodeDebugAdapterPackage.InitializedEvent): void;
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

interface IReinitializeHeaders {
    // Note: using lowercase as headers seems to be lowercased by server
    scriptpath: string;
    sourcemapurl: string;
}

declare class SourceMaps {
    constructor(session: NodeDebugSession, generatedCodeDirectory: string, generatedCodeGlobs: string[]);
    /**
     * Given a new path to a new script file, finds and loads the sourcemap for that file
     */
    public processNewSourceMap(pathToGenerated: string, sourceMapURL: string): Promise<void>;
}

declare class NodeDebugSession extends VSCodeDebugAdapterPackage.DebugSession {
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
    internalDebuggerPort?: any;
    args: string[];
    program: string;
    platform: string;
}

declare module ChromeDebuggerCorePackage {

    class BaseSourceMapTransformer {
        public sourceMaps: SourceMaps;
    }

    abstract class ChromeDebugAdapter {
        protected _session: ChromeDebugSession;
        protected _sourceMapTransformer: BaseSourceMapTransformer;

        // constructor({chromeConnection, lineColTransformer, sourceMapTransformer, pathTransformer}: IChromeDebugAdapterOpts, session: ChromeDebugSession);
        public launch(args: ILaunchRequestArgs): Promise<void>;
        public attach(args: IAttachRequestArgs): Promise<void>;
        public shutdown(): void;
        public disconnect(): void;
        protected sendInitializedEvent(): void;
        protected terminateSession(reason: string, restart?: boolean): void;
    }

    interface IChromeDebugSessionOpts {
        /** The class of the adapter, which is instantiated for each session */
        logFilePath?: string;
        adapter: typeof ChromeDebugAdapter;
        extensionName: string;
    }

    class ChromeDebugSession extends VSCodeDebugAdapterPackage.DebugSession {
        private _debugAdapter;
        constructor(debuggerLinesAndColumnsStartAt1?: boolean, isServer?: boolean, opts?: IChromeDebugSessionOpts);
        public sendEvent(event: VSCodeDebugAdapterPackage.InitializedEvent): void;
    }

}

declare module Node2DebugAdapterPackage {
    class Node2DebugAdapter extends ChromeDebuggerCorePackage.ChromeDebugAdapter {
        protected _session: ChromeDebuggerCorePackage.ChromeDebugSession;
        public launch(args: ILaunchRequestArgs): Promise<void>
        public attach(args: IAttachRequestArgs): Promise<void>
        public shutdown(): void;
        public disconnect(): void;
        public terminateSession(reason: string): void;
        protected sendInitializedEvent(): void
    }
}

