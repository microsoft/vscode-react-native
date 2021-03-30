// Type definitions for openssl-wrapper 0.3.4
// Project: https://github.com/mgcrea/node-openssl-wrapper
// Definitions by: facebook/flipper <https://github.com/facebook/flipper>

declare module "openssl-wrapper" {
    export type Action =
        | "cms.verify"
        | "genrsa"
        | "pkcs12"
        | "req"
        | "req.new"
        | "req.verify"
        | "verify"
        | "rsa"
        | "smime.verify"
        | "x509.req"
        | "x509";

    export function exec(
        action: Action,
        options: { [key: string]: string },
        cb: (error: Error | undefined, buffer: Buffer | undefined) => any,
    ): void;
}
