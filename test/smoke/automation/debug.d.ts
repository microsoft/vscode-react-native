import { Viewlet } from './viewlet';
import { Commands } from './workbench';
import { Code } from './code';
import { Editors } from './editors';
import { Editor } from './editor';
export interface IStackFrame {
    name: string;
    lineNumber: number;
}
export declare class Debug extends Viewlet {
    private commands;
    private editors;
    private editor;
    constructor(code: Code, commands: Commands, editors: Editors, editor: Editor);
    openDebugViewlet(): Promise<any>;
    configure(): Promise<any>;
    setBreakpointOnLine(lineNumber: number): Promise<any>;
    startDebugging(): Promise<number>;
    stepOver(): Promise<any>;
    stepIn(): Promise<any>;
    stepOut(): Promise<any>;
    continue(): Promise<any>;
    stopDebugging(): Promise<any>;
    waitForStackFrame(func: (stackFrame: IStackFrame) => boolean, message: string): Promise<IStackFrame>;
    waitForStackFrameLength(length: number): Promise<any>;
    focusStackFrame(name: string, message: string): Promise<any>;
    waitForReplCommand(text: string, accept: (result: string) => boolean): Promise<void>;
    waitForVariableCount(count: number, alternativeCount: number): Promise<void>;
    waitForLink(): Promise<void>;
    private waitForOutput;
}
