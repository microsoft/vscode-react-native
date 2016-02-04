// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.

import * as fs from "fs";
import * as Q from "q";
import * as path from "path";

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
     *  Helper (synchronous) function to create a directory recursively
     */
    public makeDirectoryRecursive(dirPath: string): void {
        let parentPath = path.dirname(dirPath);
        if (!this.existsSync(parentPath)) {
            this.makeDirectoryRecursive(parentPath);
        }

        fs.mkdirSync(dirPath)
    }

    /**
     *  Helper function to asynchronously copy a file
     */
    public static copyFile(from: string, to: string, encoding?: string): Q.Promise<any> {
        var deferred: Q.Deferred<any> = Q.defer();
        var destFile: fs.WriteStream = fs.createWriteStream(to, { encoding: encoding });
        var srcFile: fs.ReadStream = fs.createReadStream(from, { encoding: encoding });
        destFile.on("finish", function(): void {
            deferred.resolve({});
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

    /**
     *  Helper function to get the target path for the type definition files (to be used for intellisense).
     *  Creates the target path if it does not exist already.
     */
    public getOrCreateTypingsTargetPath(projectRoot: string): string {
        if (projectRoot) {
            let targetPath = path.resolve(projectRoot, ".vscode", "typings");
            if (!this.existsSync(targetPath)) {
                this.makeDirectoryRecursive(targetPath);
            }

            return targetPath;
        }

        return null;
    }

    public deleteFileIfExistsSync(filename: string) {
        if (this.existsSync(filename)) {
            fs.unlinkSync(filename);
        }
    }

    public readFile(filename: string, encoding: string): Q.Promise<string> {
        let contents = Q.defer<string>();

        fs.readFile(filename, encoding, (err: NodeJS.ErrnoException, data: string) => {
            if (err) {
                contents.reject(err);
            } else {
                contents.resolve(data);
            }
        });

        return contents.promise;
    }
}
