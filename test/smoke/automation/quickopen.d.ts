import { Editors } from './editors';
import { Code } from './code';
export declare class QuickOpen {
    private code;
    private editors;
    static QUICK_OPEN: string;
    static QUICK_OPEN_HIDDEN: string;
    static QUICK_OPEN_INPUT: string;
    static QUICK_OPEN_FOCUSED_ELEMENT: string;
    static QUICK_OPEN_ENTRY_SELECTOR: string;
    static QUICK_OPEN_ENTRY_LABEL_SELECTOR: string;
    constructor(code: Code, editors: Editors);
    openQuickOpen(value: string): Promise<void>;
    closeQuickOpen(): Promise<void>;
    openFile(fileName: string): Promise<void>;
    waitForQuickOpenOpened(retryCount?: number): Promise<void>;
    private waitForQuickOpenClosed;
    submit(text: string): Promise<void>;
    selectQuickOpenElement(index: number): Promise<void>;
    waitForQuickOpenElements(accept: (names: string[]) => boolean): Promise<void>;
    runCommand(command: string): Promise<void>;
    openQuickOutline(): Promise<void>;
}
