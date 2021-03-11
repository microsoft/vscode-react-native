// Type definitions for @expo/metro-config v0.1.54
// Project: https://github.com/expo/expo-cli/tree/master/packages/metro-config

declare module metroConfig {

    interface ILoadOptions {
        config?: string;
        maxWorkers?: number;
        port?: number;
        reporter?: Reporter;
        resetCache?: boolean;
        target?: ProjectTarget;
    }

    interface IResolver {
        sourceExts: string[];
    }

    interface IMetroConfig {
        resolver: IResolver;
    }

    var loadAsync: (projectRoot: string, { reporter, target, ...metroOptions }?: ILoadOptions) => Promise<IMetroConfig>

}

declare module "metro-config" {
    export = metroConfig;
}