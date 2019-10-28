import { Viewlet } from './viewlet';
import { Code } from './code';
export declare class SCM extends Viewlet {
    constructor(code: Code);
    openSCMViewlet(): Promise<any>;
    waitForChange(name: string, type?: string): Promise<void>;
    refreshSCMViewlet(): Promise<any>;
    openChange(name: string): Promise<void>;
    stage(name: string): Promise<void>;
    unstage(name: string): Promise<void>;
    commit(message: string): Promise<void>;
}
