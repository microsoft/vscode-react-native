// Type definitions for source-map-resolve

declare module "source-map-resolve" {
    export function resolveSync(code: string | null, codeUrl: string, read: Function, options?: any): any;
}