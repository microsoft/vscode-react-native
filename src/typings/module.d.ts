declare module "module" {
    class Module {
        constructor(filename: string);
        require(filename: string): any;
    }

    export = Module;
}
