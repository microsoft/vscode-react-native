import { IDriver, IDisposable } from './driver';
export declare function launch(_args: string[]): Promise<void>;
export declare function connect(headless: boolean, outPath: string, handle: string): Promise<{
    client: IDisposable;
    driver: IDriver;
}>;
