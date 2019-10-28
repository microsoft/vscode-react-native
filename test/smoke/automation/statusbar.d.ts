import { Code } from './code';
export declare const enum StatusBarElement {
    BRANCH_STATUS = 0,
    SYNC_STATUS = 1,
    PROBLEMS_STATUS = 2,
    SELECTION_STATUS = 3,
    INDENTATION_STATUS = 4,
    ENCODING_STATUS = 5,
    EOL_STATUS = 6,
    LANGUAGE_STATUS = 7,
    FEEDBACK_ICON = 8
}
export declare class StatusBar {
    private code;
    private readonly mainSelector;
    private readonly leftSelector;
    private readonly rightSelector;
    constructor(code: Code);
    waitForStatusbarElement(element: StatusBarElement): Promise<void>;
    clickOn(element: StatusBarElement): Promise<void>;
    waitForEOL(eol: string): Promise<string>;
    waitForStatusbarText(title: string, text: string): Promise<void>;
    private getSelector;
}
