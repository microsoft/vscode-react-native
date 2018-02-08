/// <reference types="node" />
import * as stream from 'stream';
export declare function generatePackageHashFromDirectory(directoryPath: string, basePath: string): Promise<string>;
export declare function generatePackageManifestFromDirectory(directoryPath: string, basePath: string): Promise<PackageManifest>;
export declare function hashFile(filePath: string): Promise<string>;
export declare function hashStream(readStream: stream.Readable): Promise<string>;
export declare class PackageManifest {
    private _map;
    constructor(map?: Map<string, string>);
    toMap(): Map<string, string>;
    computePackageHash(): string;
    serialize(): string;
    static deserialize(serializedContents: string): PackageManifest;
    static isIgnored(relativeFilePath: string): boolean;
}
