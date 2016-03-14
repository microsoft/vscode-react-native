// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.

import * as nodeFs from "fs";
import * as path from "path";
import * as Q from "q";

export class FileSystem {
    private fs: typeof nodeFs;

    constructor({ fs = nodeFs } = {}) {
        this.fs = fs;
    }

    public ensureDirectory(dir: string): Q.Promise<void> {
        return Q.nfcall(this.fs.stat, dir).then((stat: nodeFs.Stats): void => {
            if (stat.isDirectory()) {
                return;
            }
            throw new Error(`Expected ${dir} to be a directory`);
        }, (err: Error & { code?: string }): Q.Promise<any> => {
            if (err && err.code === "ENOENT") {
                return Q.nfcall(this.fs.mkdir, dir);
            }
            throw err;
        });
    }

    public ensureFileWithContents(file: string, contents: string): Q.Promise<void> {
        return Q.nfcall(this.fs.stat, file).then((stat: nodeFs.Stats) => {
            if (!stat.isFile()) {
                throw new Error(`Expected ${file} to be a file`);
            }

            return this.readFile(file).then(existingContents => {
                if (contents !== existingContents) {
                    return this.writeFile(file, contents);
                }
            });
        }, (err: Error & { code?: string }): Q.Promise<any> => {
            if (err && err.code === "ENOENT") {
                return Q.nfcall(this.fs.writeFile, file, contents);
            }
            throw err;
        });
    }

    /**
     *  Helper function to check if a file or directory exists
     */
    public existsSync(filename: string) {
        try {
            this.fs.statSync(filename);
            return true;
        } catch (error) {
            return false;
        }
    }

    /**
     *  Helper (asynchronous) function to check if a file or directory exists
     */
    public exists(filename: string): Q.Promise<boolean> {
        return Q.nfcall(this.fs.stat, filename)
            .then(function() {
                return Q.resolve(true);
            })
            .catch(function(err) {
                return Q.resolve(false);
            });
    }

    /**
     *  Helper async function to read the contents of a directory
     */
    public readDir(directory: string): Q.Promise<string[]> {
        return Q.nfcall<string[]>(this.fs.readdir, directory);
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
    public copyFile(from: string, to: string, encoding?: string): Q.Promise<void> {
        let deferred: Q.Deferred<void> = Q.defer<void>();
        let destFile: nodeFs.WriteStream = this.fs.createWriteStream(to, { encoding: encoding });
        let srcFile: nodeFs.ReadStream = this.fs.createReadStream(from, { encoding: encoding });
        destFile.on("finish", function(): void {
            deferred.resolve(void 0);
        });

        destFile.on("error", function(e: Error): void {
            deferred.reject(e);
        });

        srcFile.on("error", function(e: Error): void {
            deferred.reject(e);
        });

        srcFile.pipe(destFile);
        return deferred.promise;
    }

    public deleteFileIfExistsSync(filename: string) {
        if (this.existsSync(filename)) {
            this.fs.unlinkSync(filename);
        }
    }

    public readFile(filename: string, encoding: string = "utf8"): Q.Promise<string> {
        return Q.nfcall<string>(this.fs.readFile, filename, encoding);
    }

    public writeFile(filename: string, data: any): Q.Promise<void> {
        return Q.nfcall<void>(this.fs.writeFile, filename, data);
    }

    public unlink(filename: string): Q.Promise<void> {
        return Q.nfcall<void>(this.fs.unlink, filename);
    }

    public findFilesByExtension(folder: string, extension: string): Q.Promise<string[]> {
        return Q.nfcall(this.fs.readdir, folder).then((files: string[]) => {
            const extFiles = files.filter((file: string) => path.extname(file) === `.${extension}`);
            if (extFiles.length === 0) {
                throw new Error(`Unable to find any ${extension} files.`);
            }
            return extFiles;
        });
    }

    public mkDir(p: string): Q.Promise<void> {
        return Q.nfcall<void>(this.fs.mkdir, p);
    }

    public stat(path: string): Q.Promise<nodeFs.Stats> {
        return Q.nfcall<nodeFs.Stats>(this.fs.stat, path);
    }

    public directoryExists(directoryPath: string): Q.Promise<boolean> {
        return this.stat(directoryPath).then(stats => {
            return stats.isDirectory();
        }).catch(reason => {
            return reason.code === "ENOENT"
                ? false
                : Q.reject<boolean>(reason);
        });
    }

    public rmdir(dirPath: string): Q.Promise<void> {
        return Q.nfcall<void>(this.fs.rmdir, dirPath);
    }

    /**
     * Recursively copy 'source' to 'target' asynchronously
     *
     * @param {string} source Location to copy from
     * @param {string} target Location to copy to
     * @returns {Q.Promise} A promise which is fulfilled when the copy completes, and is rejected on error
     */
    public copyRecursive(source: string, target: string): Q.Promise<void> {
        return Q.nfcall<nodeFs.Stats>(this.fs.stat, source).then(stats => {
            if (stats.isDirectory()) {
                return this.exists(target).then(exists => {
                    if (!exists) {
                        return Q.nfcall<void>(this.fs.mkdir, target);
                    }
                })
                    .then(() => {
                        return Q.nfcall<string[]>(this.fs.readdir, source);
                    })
                    .then(contents => {
                        Q.all(contents.map((childPath: string): Q.Promise<void> => {
                            return this.copyRecursive(path.join(source, childPath), path.join(target, childPath));
                        }));
                    });
            } else {
                return this.copyFile(source, target);
            }
        });
    }

    public removePathRecursivelyAsync(p: string): Q.Promise<void> {
        return this.exists(p).then(exists => {
            if (exists) {
                return Q.nfcall<nodeFs.Stats>(this.fs.stat, p).then((stats: nodeFs.Stats) => {
                    if (stats.isDirectory()) {
                        return Q.nfcall<string[]>(this.fs.readdir, p).then((childPaths: string[]) => {
                            let result = Q<void>(void 0);
                            childPaths.forEach(childPath =>
                                result = result.then<void>(() => this.removePathRecursivelyAsync(path.join(p, childPath))));
                            return result;
                        }).then(() =>
                            Q.nfcall<void>(this.fs.rmdir, p));
                    } else {
                        /* file */
                        return Q.nfcall<void>(this.fs.unlink, p);
                    }
                });
            }
        });
    }

    public removePathRecursivelySync(p: string): void {
        if (this.fs.existsSync(p)) {
            let stats = this.fs.statSync(p);
            if (stats.isDirectory()) {
                let contents = this.fs.readdirSync(p);
                contents.forEach(childPath =>
                    this.removePathRecursivelySync(path.join(p, childPath)));
                this.fs.rmdirSync(p);
            } else {
                /* file */
                this.fs.unlinkSync(p);
            }
        }
    }
}
