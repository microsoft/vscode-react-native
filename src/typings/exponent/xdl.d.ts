// Type definitions for xdl 0.9.0
// Project: https://github.com/exponentjs/xdl
// Definitions by: Patricio Beltran <https://github.com/patobeltran>

declare module xdl {
    interface ILoginOptions {
        username: string,
        password: string
    }

    interface IUser {
        type: string,
        username: string
    }

    var User: {
        loginAsync(options: ILoginOptions): Q.Promise<IUser>;
        logoutAsync(): Q.Promise<void>;
        getCurrentUserAsync(): Q.Promise<IUser>;
    }

    interface IStartOptions {
        reset?: boolean
    }

    interface IUrlOptions {
        urlType?: "exp" | "http" | "redirect",
        hostType?: "tunnel" | "lan" | "localhost",
        dev: boolean,
        minify: boolean
    }

    interface IPublishOptions {
        quiet: boolean
    }

    interface IReactNativeServerOptions {
        reset: boolean
    }

    interface IOptions {
        packagerPort: number
    }

    interface IPublishResponse {
        err: any,
        url: string
    }

    var Project: {
        startAsync(projectRoot: string, options?: IStartOptions): Q.Promise<void>;
        stopAsync(projectRoot: string): Q.Promise<void>;
        getUrlAsync(projectRoot: string, options?: IUrlOptions): Q.Promise<string>;
        publishAsync(projectRoot: string, options?: IPublishOptions): Q.Promise<IPublishResponse>;
        startExponentServerAsync(projectRoot: string): Q.Promise<void>;
        stopExponentServerAsync(projectRoot: string): Q.Promise<void>;
        startReactNativeServerAsync(projectRoot: string, options?: IReactNativeServerOptions): Q.Promise<void>;
        stopReactNativeServerAsync(projectRoot: string): Q.Promise<void>;
        startTunnelsAsync(projectRoot: string): Q.Promise<void>;
        stopTunnelsAsync(projectRoot: string): Q.Promise<void>;
        setOptionsAsync(projectRoot: string, options?: IOptions): Q.Promise<void>;
    }

    var Versions: {
        facebookReactNativeVersionsAsync(): Promise<Array<string>>;
        facebookReactNativeVersionToExponentVersionAsync(facebookReactNativeVersion: string): Promise<string>;
    }

    interface IApiConfig {
        scheme: string,
        host: string,
        port: number
    }

    interface INgrokConfig {
        authToken: string,
        authTokenPublicId: string,
        domain: string
    }

    interface IValidationConfig {
        reactNativeVersionWarnings: boolean
    }

    interface IConfig {
        api: IApiConfig,
        ngrok: INgrokConfig,
        developerTool: any,
        validation: IValidationConfig
    }

    var Config: IConfig;
}

declare module "xdl" {
    export = xdl;
}