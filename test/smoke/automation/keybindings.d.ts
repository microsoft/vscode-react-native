import { Code } from './code';
export declare class KeybindingsEditor {
    private code;
    constructor(code: Code);
    updateKeybinding(command: string, keybinding: string, ariaLabel: string): Promise<any>;
}
