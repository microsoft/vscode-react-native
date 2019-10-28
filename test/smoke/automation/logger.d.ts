export interface Logger {
    log(message: string, ...args: any[]): void;
}
export declare class ConsoleLogger implements Logger {
    log(message: string, ...args: any[]): void;
}
export declare class FileLogger implements Logger {
    private path;
    constructor(path: string);
    log(message: string, ...args: any[]): void;
}
export declare class MultiLogger implements Logger {
    private loggers;
    constructor(loggers: Logger[]);
    log(message: string, ...args: any[]): void;
}
