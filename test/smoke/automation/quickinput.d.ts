import { Code } from './code';
export declare class QuickInput {
    private code;
    static QUICK_INPUT: string;
    static QUICK_INPUT_INPUT: string;
    static QUICK_INPUT_FOCUSED_ELEMENT: string;
    constructor(code: Code);
    closeQuickInput(): Promise<void>;
    waitForQuickInputOpened(retryCount?: number): Promise<void>;
    private waitForQuickInputClosed;
    selectQuickInputElement(index: number): Promise<void>;
}
