declare module "strip-json-comments" {
    function stripJsonComments(input: string, options?: {whitespace: boolean}): string;
    export = stripJsonComments;
}