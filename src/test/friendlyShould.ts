/* tslint:disable:no-var-keyword */
/* tslint:disable:no-var-requires */
/* tslint:disable:no-unused-variable */
// var require needed for should module to work correctly
// Note not import: We don't want to refer to shouldModule, but we need the require to occur since it modifies the prototype of Object.
var shouldModule: any = require("should");
/* tslint:enable:no-unused-variable */
/* tslint:enable:no-var-requires */
/* tslint:enable:no-var-keyword */

export class Nothing {
    public static supressTSLintWarning(): void {
    }
}