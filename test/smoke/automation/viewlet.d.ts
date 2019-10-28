import { Code } from './code';
export declare abstract class Viewlet {
    protected code: Code;
    constructor(code: Code);
    waitForTitle(fn: (title: string) => boolean): Promise<void>;
}
