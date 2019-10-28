import { Viewlet } from './viewlet';
import { Code } from './code';
export declare class Search extends Viewlet {
    constructor(code: Code);
    openSearchViewlet(): Promise<any>;
    searchFor(text: string): Promise<void>;
    submitSearch(): Promise<void>;
    setFilesToIncludeText(text: string): Promise<void>;
    showQueryDetails(): Promise<void>;
    hideQueryDetails(): Promise<void>;
    removeFileMatch(filename: string): Promise<void>;
    expandReplace(): Promise<void>;
    collapseReplace(): Promise<void>;
    setReplaceText(text: string): Promise<void>;
    replaceFileMatch(filename: string): Promise<void>;
    waitForResultText(text: string): Promise<void>;
    waitForNoResultText(): Promise<void>;
    private waitForInputFocus;
}
