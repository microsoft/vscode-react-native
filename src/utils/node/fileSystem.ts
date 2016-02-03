// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.

import * as fs from "fs";
import * as Q from "q";

export class FileSystem {

    public ensureDirectory(dir: string): Q.Promise<void> {
        return Q.nfcall(fs.stat, dir).then((stat: fs.Stats): void => {
            if (stat.isDirectory()) {
                return;
            } else {
                throw new Error(`Expected ${dir} to be a directory`);
            }
        }, (err: Error & {code?: string}): Q.Promise<any> => {
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
        }, (err: Error & {code?: string}): Q.Promise<any> => {
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

    public writeFile(filename: string, data: any): Q.Promise<void> {
        let contents = Q.defer<void>();

        fs.writeFile(filename, data, (err: NodeJS.ErrnoException) => {
            if (err) {
                contents.reject(err);
            } else {
                contents.resolve(null);
            }
        });

        return contents.promise;
    }
}
