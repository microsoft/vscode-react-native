import { Explorer } from './explorer';
import { ActivityBar } from './activityBar';
import { QuickOpen } from './quickopen';
import { QuickInput } from './quickinput';
import { Extensions } from './extensions';
import { Search } from './search';
import { Editor } from './editor';
import { SCM } from './scm';
import { Debug } from './debug';
import { StatusBar } from './statusbar';
import { Problems } from './problems';
import { SettingsEditor } from './settings';
import { KeybindingsEditor } from './keybindings';
import { Editors } from './editors';
import { Code } from './code';
import { Terminal } from './terminal';
export interface Commands {
    runCommand(command: string): Promise<any>;
}
export declare class Workbench {
    readonly quickopen: QuickOpen;
    readonly quickinput: QuickInput;
    readonly editors: Editors;
    readonly explorer: Explorer;
    readonly activitybar: ActivityBar;
    readonly search: Search;
    readonly extensions: Extensions;
    readonly editor: Editor;
    readonly scm: SCM;
    readonly debug: Debug;
    readonly statusbar: StatusBar;
    readonly problems: Problems;
    readonly settingsEditor: SettingsEditor;
    readonly keybindingsEditor: KeybindingsEditor;
    readonly terminal: Terminal;
    constructor(code: Code, userDataPath: string);
}
