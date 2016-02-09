declare module "vm" {
    // See https://nodejs.org/api/vm.html#vm_class_script
    interface IRunningScriptOptions {
        filename: string; // Allows you to control the filename that shows up in any stack traces produced from this script.
        lineOffset: number; // Allows you to add an offset to the line number that is displayed in stack traces
        columnOffset: number; // Allows you to add an offset to the column number that is displayed in stack traces
        displayErrors: boolean; // Whether or not to print any errors to stderr, with the line of code that caused them highlighted, before throwing an exception. Applies only to syntax errors compiling the code; errors while running the code are controlled by the options to the script's methods.
        timeout: number; // A number of milliseconds to execute code before terminating execution. If execution is terminated, an Error will be thrown.
    }

    class Script {
        constructor(code: string, options?: IRunningScriptOptions);
        runInContext(contextifiedSandbox: Context, options?: IRunningScriptOptions): any;
    }
}
