import { IDriver, IDisposable, IElement } from './driver';
import { Logger } from './logger';
export interface SpawnOptions {
    codePath?: string;
    workspacePath: string;
    userDataDir: string;
    extensionsPath: string;
    logger: Logger;
    verbose?: boolean;
    extraArgs?: string[];
    log?: string;
    /** Run in the test resolver */
    remote?: boolean;
    /** Run in the web */
    web?: boolean;
    /** Run in headless mode (only applies when web is true) */
    headless?: boolean;
}
export declare function spawn(options: SpawnOptions): Promise<Code>;
export declare class Code {
    private client;
    readonly logger: Logger;
    private _activeWindowId;
    private driver;
    constructor(client: IDisposable, driver: IDriver, logger: Logger);
    capturePage(): Promise<string>;
    waitForWindowIds(fn: (windowIds: number[]) => boolean): Promise<void>;
    dispatchKeybinding(keybinding: string): Promise<void>;
    reload(): Promise<void>;
    exit(): Promise<void>;
    waitForTextContent(selector: string, textContent?: string, accept?: (result: string) => boolean): Promise<string>;
    waitAndClick(selector: string, xoffset?: number, yoffset?: number): Promise<void>;
    waitAndDoubleClick(selector: string): Promise<void>;
    waitForSetValue(selector: string, value: string): Promise<void>;
    waitForElements(selector: string, recursive: boolean, accept?: (result: IElement[]) => boolean): Promise<IElement[]>;
    waitForElement(selector: string, accept?: (result: IElement | undefined) => boolean, retryCount?: number): Promise<IElement>;
    waitForActiveElement(selector: string, retryCount?: number): Promise<void>;
    waitForTitle(fn: (title: string) => boolean): Promise<void>;
    waitForTypeInEditor(selector: string, text: string): Promise<void>;
    waitForTerminalBuffer(selector: string, accept: (result: string[]) => boolean): Promise<void>;
    writeInTerminal(selector: string, value: string): Promise<void>;
    private getActiveWindowId;
    dispose(): void;
}
export declare function findElement(element: IElement, fn: (element: IElement) => boolean): IElement | null;
export declare function findElements(element: IElement, fn: (element: IElement) => boolean): IElement[];
