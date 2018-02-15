/// <reference types="node" />
import * as fs from 'fs';
export declare function fileExists(file: string): boolean;
export declare function isBinaryOrZip(path: string): boolean;
export declare function isDirectory(path: string): boolean;
export declare function copyFileToTmpDir(filePath: string): string;
export declare function generateRandomFilename(length: number): string;
export declare function fileDoesNotExistOrIsDirectory(path: string): boolean;
export declare function createEmptyTmpReleaseFolder(folderPath: string): void;
export declare function removeReactTmpDir(): void;
export declare function normalizePath(filePath: string): string;
export declare function walk(dir: string): Promise<string[]>;
export declare function stat(path: string | Buffer): Promise<fs.Stats>;
export declare function readdir(path: string | Buffer): Promise<string[]>;
export declare function readFile(filename: string): Promise<Buffer>;
export declare function readFile(filename: string, encoding: string): Promise<string>;
export declare function readFile(filename: string, options: {
    flag?: string;
}): Promise<Buffer>;
export declare function readFile(filename: string, options?: string | {
    encoding: string;
    flag?: string;
}): Promise<string>;
export declare function access(path: string | Buffer, mode: number): Promise<void>;
export declare function rmDir(source: string, recursive?: boolean): Promise<void>;
export declare function mkTempDir(affixes: string): Promise<string>;
