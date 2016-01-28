/**
 * React native bridge.
 */
declare var __fbBatchedBridge: any;

/**
 * Mobile platform dependent strategy.
 * It contains all the platform specific debugging operations.
 */
interface IDebugStrategy {
    runApp(): Q.Promise<void>;
    enableJSDebuggingMode(): Q.Promise<void>;
}

/**
 * Dev-machine platform dependent packager strategy.
 * It contains all the platform specific, packager related operations.
 */
interface IPackagerStrategy {
    startIfNeeded(): Q.Promise<number>;
    packagerStartExtraParameters(): string[];
    executableName(): string;
}