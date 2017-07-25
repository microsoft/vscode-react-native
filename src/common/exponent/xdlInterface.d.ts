// Type definitions for xdl 0.9.0
// Project: https://github.com/exponentjs/xdl
// Definitions by: Patricio Beltran <https://github.com/patobeltran>

declare module xdl {

    interface IUser {
        type: string;
        username: string;
    }

    interface IUrlOptions {
        urlType?: "exp" | "http" | "redirect";
        hostType?: "tunnel" | "lan" | "localhost";
        dev: boolean;
        minify: boolean;
    }

    interface IPublishOptions {
        quiet: boolean;
    }

    interface IOptions {
        packagerPort: number;
    }

    interface IPublishResponse {
        err: any;
        url: string;
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
}

declare module "XDLPackage" {
    export = xdl;
}