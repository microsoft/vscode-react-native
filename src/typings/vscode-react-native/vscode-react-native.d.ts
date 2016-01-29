/**
 * React native bridge.
 */
declare var __fbBatchedBridge: any;

/**
 * Contains all the mobile platform specific debugging operations.
 */
interface IMobilePlatform {
    runApp(): Q.Promise<void>;
    enableJSDebuggingMode(): Q.Promise<void>;
}

/**
 * Contains all the desktop platform specific operations.
 */
interface IDesktopPlatform {
    packagerCommandName: string;
    packagerStartExtraParameters: string[];
}