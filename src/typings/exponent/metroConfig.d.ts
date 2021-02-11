declare module metroConfig {

    interface ILoadOptions {
        config?: string;
        maxWorkers?: number;
        port?: number;
        reporter?: Reporter;
        resetCache?: boolean;
        target?: ProjectTarget;
    }

    interface IMetroConfig {

    }

    var loadAsync: (projectRoot: string, { reporter, target, ...metroOptions }?: ILoadOptions) => Promise<any>

}

declare module "metro-config" {
    export = metroConfig;
}