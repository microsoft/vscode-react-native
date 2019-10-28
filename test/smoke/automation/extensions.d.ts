import { Viewlet } from './viewlet';
import { Code } from './code';
export declare class Extensions extends Viewlet {
    constructor(code: Code);
    openExtensionsViewlet(): Promise<any>;
    waitForExtensionsViewlet(): Promise<any>;
    searchForExtension(id: string): Promise<any>;
    installExtension(id: string, name: string): Promise<void>;
}
