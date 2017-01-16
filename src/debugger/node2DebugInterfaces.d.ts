/*---------------------------------------------------------
 * Copyright (C) Microsoft Corporation. All rights reserved.
 *--------------------------------------------------------*/

import {DebugProtocol} from 'vscode-debugprotocol';
import * as Core from 'vscode-chrome-debug-core';

type ConsoleType = "internalConsole" | "integratedTerminal" | "externalTerminal";

interface ICommonArgs {
    stopOnEntry?: boolean;
    address?: string;
    timeout?: number;
}

/**
 * This interface should always match the schema found in the node-debug extension manifest.
 */
export declare interface LaunchRequestArguments extends Core.ILaunchRequestArgs, ICommonArgs {
    /** An absolute path to the program to debug. */
    program: string;
    /** Optional arguments passed to the debuggee. */
    args?: string[];
    /** Launch the debuggee in this working directory (specified as an absolute path). If omitted the debuggee is lauched in its own directory. */
    cwd: string;
    /** Absolute path to the runtime executable to be used. Default is the runtime executable on the PATH. */
    runtimeExecutable?: string;
    /** Optional arguments passed to the runtime executable. */
    runtimeArgs?: string[];
    /** Optional environment variables to pass to the debuggee. The string valued properties of the 'environmentVariables' are used as key/value pairs. */
    env?: { [key: string]: string; };
    /** Where to launch the debug target. */
    console?: ConsoleType;
    /** Manually selected debugging port */
    port?: number;

    /** Logging options */
    diagnosticLogging?: boolean;
    verboseDiagnosticLogging?: boolean;
}

/**
 * This interface should always match the schema found in the node-debug extension manifest.
 */
export declare interface AttachRequestArguments extends Core.IAttachRequestArgs, ICommonArgs {
    /** Request frontend to restart session on termination. */
    restart?: boolean;
    /** Node's root directory. */
    remoteRoot?: string;
    /** VS Code's root directory. */
    localRoot?: string;
    /** Send a USR1 signal to this process. */
    processId?: string;
    /** Optional cwd for sourceMapPathOverrides resolution */
    cwd?: string;
}

declare type NodeDebugError = DebugProtocol.Message & Error;
