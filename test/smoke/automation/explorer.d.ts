import { Viewlet } from './viewlet';
import { Editors } from './editors';
import { Code } from './code';
export declare class Explorer extends Viewlet {
    private editors;
    private static readonly EXPLORER_VIEWLET;
    private static readonly OPEN_EDITORS_VIEW;
    constructor(code: Code, editors: Editors);
    openExplorerView(): Promise<any>;
    waitForOpenEditorsViewTitle(fn: (title: string) => boolean): Promise<void>;
    openFile(fileName: string): Promise<any>;
    getExtensionSelector(fileName: string): string;
}
