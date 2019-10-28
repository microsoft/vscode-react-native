import { Code } from './code';
export declare class Editors {
    private code;
    constructor(code: Code);
    saveOpenedFile(): Promise<any>;
    selectTab(tabName: string, untitled?: boolean): Promise<void>;
    waitForActiveEditor(filename: string): Promise<any>;
    waitForEditorFocus(fileName: string, untitled?: boolean): Promise<void>;
    waitForActiveTab(fileName: string, isDirty?: boolean): Promise<void>;
    waitForTab(fileName: string, isDirty?: boolean): Promise<void>;
    newUntitledFile(): Promise<void>;
}
