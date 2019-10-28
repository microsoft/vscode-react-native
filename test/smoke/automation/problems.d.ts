import { Code } from './code';
export declare const enum ProblemSeverity {
    WARNING = 0,
    ERROR = 1
}
export declare class Problems {
    private code;
    static PROBLEMS_VIEW_SELECTOR: string;
    constructor(code: Code);
    showProblemsView(): Promise<any>;
    hideProblemsView(): Promise<any>;
    private toggleProblemsView;
    waitForProblemsView(): Promise<void>;
    static getSelectorInProblemsView(problemType: ProblemSeverity): string;
    static getSelectorInEditor(problemType: ProblemSeverity): string;
}
