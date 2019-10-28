import { References } from './peek';
import { Commands } from './workbench';
import { Code } from './code';
export declare class Editor {
    private code;
    private commands;
    private static readonly FOLDING_EXPANDED;
    private static readonly FOLDING_COLLAPSED;
    constructor(code: Code, commands: Commands);
    findReferences(filename: string, term: string, line: number): Promise<References>;
    rename(filename: string, line: number, from: string, to: string): Promise<void>;
    gotoDefinition(filename: string, term: string, line: number): Promise<void>;
    peekDefinition(filename: string, term: string, line: number): Promise<References>;
    waitForHighlightingLine(filename: string, line: number): Promise<void>;
    private getSelector;
    foldAtLine(filename: string, line: number): Promise<any>;
    unfoldAtLine(filename: string, line: number): Promise<any>;
    private clickOnTerm;
    waitForEditorFocus(filename: string, lineNumber: number, selectorPrefix?: string): Promise<void>;
    waitForTypeInEditor(filename: string, text: string, selectorPrefix?: string): Promise<any>;
    waitForEditorContents(filename: string, accept: (contents: string) => boolean, selectorPrefix?: string): Promise<any>;
    private getClassSelectors;
    private getViewLineIndex;
}
