// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.

import * as nodeFs from "fs";
import * as path from "path";
import * as mkdirp from "mkdirp";

export class FileSystem {
    private fs: typeof nodeFs;

    constructor({ fs = nodeFs } = {}) {
        this.fs = fs;
    }

    public async ensureDirectory(dir: string): Promise<void> {
        try {
            const stat = await this.stat(dir);
            if (!stat.isDirectory()) {
                throw new Error(`Expected ${dir} to be a directory`);
            }
        } catch (err) {
            if (err && err.code === "ENOENT") {
                return this.mkDir(dir);
            }
            throw err;
        }
    }

    public async ensureFileWithContents(file: string, contents: string): Promise<void> {
        try {
            const stat = await this.stat(file);
            if (stat.isFile()) {
                const existingContents = await this.readFile(file);
                if (contents !== existingContents) {
                    return this.writeFile(file, contents);
                }
            } else {
                throw new Error(`Expected ${file} to be a file`);
            }
        } catch (err) {
            if (err && err.code === "ENOENT") {
                return this.writeFile(file, contents);
            }
            throw err;
        }
    }

    /**
     *  Helper function to check if a file or directory exists
     */
    public existsSync(filename: string): boolean {
        return this.fs.existsSync(filename);
    }

    /**
     *  Helper (asynchronous) function to check if a file or directory exists
     */
    public async exists(filename: string): Promise<boolean> {
        try {
            await this.stat(filename);
            return true;
        } catch (err) {
            return false;
        }
    }

    /**
     *  Helper async function to read the contents of a directory
     */
    public readDir(directory: string): Promise<string[]> {
        return this.fs.promises.readdir(directory);
    }

    /**
     *  Helper (synchronous) function to create a directory recursively
     */
    public makeDirectoryRecursiveSync(dirPath: string): void {
        let parentPath = path.dirname(dirPath);
        if (!this.existsSync(parentPath)) {
            this.makeDirectoryRecursiveSync(parentPath);
        }

        this.fs.mkdirSync(dirPath);
    }

    /**
     *  Helper function to asynchronously copy a file
     */
    public copyFile(from: string, to: string): Promise<void> {
        return this.fs.promises.copyFile(from, to);
    }

    public deleteFileIfExistsSync(filename: string): void {
        if (this.existsSync(filename)) {
            this.fs.unlinkSync(filename);
        }
    }

    public readFile(filename: string, encoding: string = "utf8"): Promise<string | Buffer> {
        return this.fs.promises.readFile(filename, { encoding });
    }

    public writeFile(filename: string, data: any): Promise<void> {
        return this.fs.promises.writeFile(filename, data);
    }

    public static writeFileToFolder(folder: string, basename: string, data: any): Promise<void> {
        if (!nodeFs.existsSync(folder)) {
            mkdirp.sync(folder);
        }
        return nodeFs.promises.writeFile(path.join(folder, basename), data);
    }

    public unlink(filename: string): Promise<void> {
        return this.fs.promises.unlink(filename);
    }

    public mkDir(p: string): Promise<void> {
        return this.fs.promises.mkdir(p);
    }

    public stat(fsPath: string): Promise<nodeFs.Stats> {
        return this.fs.promises.stat(fsPath);
    }

    public async directoryExists(directoryPath: string): Promise<boolean> {
        try {
            const stats = await this.stat(directoryPath);
            return stats.isDirectory();
        } catch (err) {
            if (err.code === "ENOENT") {
                return false;
            }
            throw err;
        }
    }

    /**
     * Delete 'dirPath' if it's an empty folder. If not fail.
     *
     * @param {dirPath} path to the folder
     * @returns {void} Nothing
     */
    public rmdir(dirPath: string): Promise<void> {
        return this.fs.promises.rmdir(dirPath);
    }

    public async removePathRecursivelyAsync(p: string): Promise<void> {
        const exists = await this.exists(p);
        if (exists) {
            const stats = await this.stat(p);
            if (stats.isDirectory()) {
                const childPaths = await this.readDir(p);
                await Promise.all(
                    childPaths.map(childPath =>
                        this.removePathRecursivelyAsync(path.join(p, childPath)),
                    ),
                );
                await this.rmdir(p);
            } else {
                /* file */
                return this.unlink(p);
            }
        }
    }

    public removePathRecursivelySync(p: string): void {
        if (this.fs.existsSync(p)) {
            let stats = this.fs.statSync(p);
            if (stats.isDirectory()) {
                let contents = this.fs.readdirSync(p);
                contents.forEach(childPath =>
                    this.removePathRecursivelySync(path.join(p, childPath)),
                );
                this.fs.rmdirSync(p);
            } else {
                /* file */
                this.fs.unlinkSync(p);
            }
        }
    }
}
