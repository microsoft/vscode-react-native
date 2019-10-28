import { Code } from './code';
import { QuickOpen } from './quickopen';
export declare class Terminal {
    private code;
    private quickopen;
    constructor(code: Code, quickopen: QuickOpen);
    showTerminal(): Promise<void>;
    runCommand(commandText: string): Promise<void>;
    waitForTerminalText(accept: (buffer: string[]) => boolean): Promise<void>;
}
