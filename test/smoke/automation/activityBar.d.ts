import { Code } from './code';
export declare const enum ActivityBarPosition {
    LEFT = 0,
    RIGHT = 1
}
export declare class ActivityBar {
    private code;
    constructor(code: Code);
    waitForActivityBar(position: ActivityBarPosition): Promise<void>;
}
