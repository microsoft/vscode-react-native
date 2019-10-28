import { Workbench } from './workbench';
import { Code, SpawnOptions } from './code';
import { Logger } from './logger';
export declare const enum Quality {
    Dev = 0,
    Insiders = 1,
    Stable = 2
}
export interface ApplicationOptions extends SpawnOptions {
    quality: Quality;
    workspacePath: string;
    waitTime: number;
    screenshotsPath: string | null;
}
export declare class Application {
    private options;
    private _code;
    private _workbench;
    constructor(options: ApplicationOptions);
    readonly quality: Quality;
    readonly code: Code;
    readonly workbench: Workbench;
    readonly logger: Logger;
    readonly remote: boolean;
    private _workspacePathOrFolder;
    readonly workspacePathOrFolder: string;
    readonly extensionsPath: string;
    readonly userDataPath: string;
    start(expectWalkthroughPart?: boolean): Promise<any>;
    restart(options: {
        workspaceOrFolder?: string;
        extraArgs?: string[];
    }): Promise<any>;
    private _start;
    reload(): Promise<any>;
    stop(): Promise<any>;
    captureScreenshot(name: string): Promise<void>;
    private startApplication;
    private checkWindowReady;
}
