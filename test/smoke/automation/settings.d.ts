import { Editor } from './editor';
import { Editors } from './editors';
import { Code } from './code';
import { QuickOpen } from './quickopen';
export declare class SettingsEditor {
    private code;
    private userDataPath;
    private editors;
    private editor;
    private quickopen;
    constructor(code: Code, userDataPath: string, editors: Editors, editor: Editor, quickopen: QuickOpen);
    addUserSetting(setting: string, value: string): Promise<void>;
    clearUserSettings(): Promise<void>;
    private openSettings;
}
