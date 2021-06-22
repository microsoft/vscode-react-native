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

    interface IUserManager {
        default: {
            loginAsync(loginType: string, options: ILoginOptions): Promise<IUser>,
            logoutAsync(): Promise<void>,
            getCurrentUserAsync(): Promise<IUser>,
        }
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

    interface SDKVersion {
        androidExpoViewUrl?: string;
        expoReactNativeTag: string;
        /* deprecated */ exponentReactNativeTag?: string;
        expokitNpmPackage?: string;
        facebookReactNativeVersion: string;
        facebookReactVersion?: string;
        iosExpoViewUrl?: string;
        /* deprecated */ iosExponentViewUrl?: string;
        iosVersion?: string;
        isDeprecated?: boolean;
        packagesToInstallWhenEjecting?: { [name: string]: string };
        releaseNoteUrl?: string;
        iosClientUrl?: string;
        iosClientVersion?: string;
        androidClientUrl?: string;
        androidClientVersion?: string;
        relatedPackages?: { [name: string]: string };
        beta?: boolean;
    }

    interface SDKVersions {
        [version: string]: SDKVersion;
    }

    interface IVersions {
        sdkVersionsAsync(): Promise<SDKVersions>;
        releasedSdkVersionsAsync(): Promise<SDKVersions>;
    }

    interface IProject {
        startAsync(projectRoot: string, options?: IStartOptions): Promise<void>;
        stopAsync(projectRoot: string): Promise<void>;
        getUrlAsync(projectRoot: string, options?: IUrlOptions): Promise<string>;
        publishAsync(projectRoot: string, options?: IPublishOptions): Promise<IPublishResponse>;
        startExpoServerAsync(projectRoot: string): Promise<void>;
        stopExpoServerAsync(projectRoot: string): Promise<void>;
        startReactNativeServerAsync(projectRoot: string, options?: IReactNativeServerOptions): Promise<void>;
        stopReactNativeServerAsync(projectRoot: string): Promise<void>;
        startTunnelsAsync(projectRoot: string): Promise<void>;
        stopTunnelsAsync(projectRoot: string): Promise<void>;
        setOptionsAsync(projectRoot: string, options?: IOptions): Promise<void>;
    }

    interface IUrlUtils {
        constructManifestUrlAsync(projectRoot: string, opts?: any, requestHostname?: string): Promise<string>;
    }

    interface IAndroid {
        startAdbReverseAsync(projectRoot: string): Promise<boolean>;
        stopAdbReverseAsync(projectRoot: string): Promise<void>;
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

    interface IBunyanStream {
        type?: string;
        level?: number | string;
        path?: string;
        stream?: NodeJS.WritableStream | IBunyanStream;
        closeOnExit?: boolean;
        period?: string;
        count?: number;
    }

    interface IProjectUtils {
        attachLoggerStream(rootPath: string, options?: IBunyanStream): void;
    }

    interface ResolveNgrok
    {
        resolveNgrokAsync(
            projectRoot: string,
            {
                shouldPrompt = true,
                autoInstall = false,
            }: { shouldPrompt?: boolean; autoInstall?: boolean } = {},
        ): Promise<any>;
    };
}

declare module "xdl" {
    export = xdl;
}