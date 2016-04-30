declare module "module" {
    class Module {
        static _nodeModulePaths(directory: string): string[];
        constructor(filename: string);
        require(filename: string): any;

        paths: string[];
    }

    export = Module;
}
