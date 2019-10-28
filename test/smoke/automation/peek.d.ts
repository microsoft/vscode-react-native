import { Code } from './code';
export declare class References {
    private code;
    private static readonly REFERENCES_WIDGET;
    private static readonly REFERENCES_TITLE_FILE_NAME;
    private static readonly REFERENCES_TITLE_COUNT;
    private static readonly REFERENCES;
    constructor(code: Code);
    waitUntilOpen(): Promise<void>;
    waitForReferencesCountInTitle(count: number): Promise<void>;
    waitForReferencesCount(count: number): Promise<void>;
    waitForFile(file: string): Promise<void>;
    close(): Promise<void>;
}
