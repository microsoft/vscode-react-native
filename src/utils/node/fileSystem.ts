// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.

import * as fs from "fs";
import * as path from "path";
import * as Q from "q";

export class FileSystem {

    public ensureDirectory(dir: string): Q.Promise<void> {
        return Q.nfcall(fs.stat, dir).then((stat: fs.Stats): void => {
            if (stat.isDirectory()) {
                return;
            }
            throw new Error(`Expected ${dir} to be a directory`);
        }, (err: Error & { code?: string }): Q.Promise<any> => {
            if (err && err.code === "ENOENT") {
                return Q.nfcall(fs.mkdir, dir);
            }
            throw err;
        });
    }

    public ensureFileWithContents(file: string, contents: string): Q.Promise<void> {
        return Q.nfcall(fs.stat, file).then((stat: fs.Stats): void => {
            if (!stat.isFile()) {
                throw new Error(`Expected ${file} to be a file`);
            }
            // The file already exists, assume the contents are good and do not touch it.
        }, (err: Error & { code?: string }): Q.Promise<any> => {
            if (err && err.code === "ENOENT") {
                return Q.nfcall(fs.writeFile, file, contents);
            }
            throw err;
        });
    }

    /**
     *  Helper function to check if a file or directory exists
     */
    public existsSync(filename: string) {
        try {
            fs.statSync(filename);
            return true;
        } catch (error) {
            return false;
        }
    }

    /**
     *  Helper (asynchronous) function to check if a file or directory exists
     */
    public exists(filename: string): Q.Promise<boolean> {
        return Q.nfcall(fs.stat, filename)
            .then(function(){
                return Q.resolve(true);
            })
            .catch(function(err) {
                return Q.resolve(false);
            });
    }

    /**
     *  Helper (synchronous) function to create a directory recursively
     */
    public makeDirectoryRecursiveSync(dirPath: string): void {
        let parentPath = path.dirname(dirPath);
        if (!this.existsSync(parentPath)) {
            this.makeDirectoryRecursiveSync(parentPath);
        }

        fs.mkdirSync(dirPath);
    }

    /**
     *  Helper function to asynchronously copy a file
     */
    public copyFile(from: string, to: string, encoding?: string): Q.Promise<void> {
        var deferred: Q.Deferred<void> = Q.defer<void>();
        var destFile: fs.WriteStream = fs.createWriteStream(to, { encoding: encoding });
        var srcFile: fs.ReadStream = fs.createReadStream(from, { encoding: encoding });
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
            fs.unlinkSync(filename);
        }
    }

    public readFile(filename: string, encoding: string = "utf8"): Q.Promise<string> {
        return Q.nfcall<string>(fs.readFile, filename, encoding);
    }

    public writeFile(filename: string, data: any): Q.Promise<void> {
        return Q.nfcall<void>(fs.writeFile, filename, data);
    }

    public findFilesByExtension(folder: string, extension: string): Q.Promise<string[]> {
        return Q.nfcall(fs.readdir, folder).then((files: string[]) => {
            const extFiles = files.filter((file: string) => path.extname(file) === `.${extension}`);
            if (extFiles.length === 0) {
                throw new Error(`Unable to find any ${extension} files.`);
            }
            return extFiles;
        });
    }

    public mkDir(p: string): Q.Promise<void> {
        return Q.nfcall<void>(fs.mkdir, p);
    }

    /**
     * Recursively copy 'source' to 'target' asynchronously
     *
     * @param {string} source Location to copy from
     * @param {string} target Location to copy to
     * @returns {Q.Promise} A promise which is fulfilled when the copy completes, and is rejected on error
     */
    public copyRecursive(source: string, target: string): Q.Promise<void> {
        return Q.nfcall<fs.Stats>(fs.stat, source).then(stats => {
            if (stats.isDirectory()) {
                return this.exists(target).then(exists => {
                    if (!exists) {
                        return Q.nfcall<void>(fs.mkdir, target);
                    }
                })
                .then(() => {
                    return Q.nfcall<string[]>(fs.readdir, source);
                })
                .then(contents => {
                    Q.all(contents.map((childPath:string): Q.Promise<void> => {
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
                return Q.nfcall<fs.Stats>(fs.stat, p).then((stats: fs.Stats) => {
                    if (stats.isDirectory()) {
                        return Q.nfcall<string[]>(fs.readdir, p).then((childPaths: string[]) => {
                            let result = Q<void>(void 0);
                            childPaths.forEach(childPath =>
                                result = result.then<void>(() => this.removePathRecursivelyAsync(path.join(p, childPath))));
                            return result;
                        }).then(() =>
                            Q.nfcall<void>(fs.rmdir, p));
                    } else {
                        /* file */
                        return Q.nfcall<void>(fs.unlink, p);
                    }
                });
            }
        });
    }

    public removePathRecursivelySync(p: string): void {
        if (fs.existsSync(p)) {
            let stats = fs.statSync(p);
            if (stats.isDirectory()) {
                let contents = fs.readdirSync(p);
                contents.forEach(childPath =>
                    this.removePathRecursivelySync(path.join(p, childPath)));
                fs.rmdirSync(p);
            } else {
                /* file */
                fs.unlinkSync(p);
            }
        }
    }
}
