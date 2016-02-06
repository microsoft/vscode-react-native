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
            } else {
                throw new Error(`Expected ${dir} to be a directory`);
            }
        }, (err: Error & { code?: string }): Q.Promise<any> => {
            if (err && err.code === "ENOENT") {
                return Q.nfcall(fs.mkdir, dir);
            } else {
                throw err;
            }
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
            } else {
                throw err;
            }
        });
    }

    public fileExistsSync(filename: string) {
        try {
            fs.lstatSync(filename);
            return true;
        } catch (error) {
            return false;
        }
    }

    public deleteFileIfExistsSync(filename: string) {
        if (this.fileExistsSync(filename)) {
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

    public pathExists(p: string): Q.Promise<boolean> {
        let deferred = Q.defer<boolean>();
        fs.exists(p, deferred.resolve);
        return deferred.promise;
    }

    public mkDir(p: string): Q.Promise<void> {
        return Q.nfcall<void>(fs.mkdir, p);
    }

    public removePathRecursivelyAsync(p: string): Q.Promise<void> {
        return this.pathExists(p).then(exists => {
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
